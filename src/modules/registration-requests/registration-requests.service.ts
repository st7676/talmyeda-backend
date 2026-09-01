import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FieldEntityType, InstitutionStatus, Role } from '../../common/enums';
import { AppError } from '../../common/errors/app-error';
import { PaginatedResult } from '../../common/interfaces';
import { hashPassword } from '../../common/utils/password.util';
import { escapeRegex } from '../../common/utils/regex.util';
import { DynamicFieldsValidatorService } from '../dynamic-fields/dynamic-fields-validator.service';
import { FieldDefinitionsService } from '../field-definitions/field-definitions.service';
import { InstitutionsService } from '../institutions/institutions.service';
import { ParticipantUserMode } from '../institutions/schemas/institution-settings.schema';
import { ParticipantsService } from '../participants/participants.service';
import { StaffService } from '../staff/staff.service';
import { UsersService } from '../users/users.service';
import { ApproveRegistrationRequestDto } from './dto/approve-registration-request.dto';
import { PublicFieldsQueryDto } from './dto/public-fields-query.dto';
import { QueryRegistrationRequestsDto } from './dto/query-registration-requests.dto';
import { SubmitRegistrationRequestDto } from './dto/submit-registration-request.dto';
import {
  RegistrationRequest,
  RegistrationRequestDocument,
  RegistrationRequestStatus,
} from './schemas/registration-request.schema';

/** Public-safe field metadata for rendering a self-registration form. */
export interface PublicFieldMeta {
  internalKey: string;
  displayName: string;
  fieldType: string;
  required: boolean;
  options?: { label: string; value: string }[];
}

/** entityType -> the Role whose FieldDefinition.permissions apply to self-edit. */
function selfRoleFor(
  entityType: FieldEntityType.Participant | FieldEntityType.Staff,
): Role.Participant | Role.Staff {
  return entityType === FieldEntityType.Staff ? Role.Staff : Role.Participant;
}

@Injectable()
export class RegistrationRequestsService {
  constructor(
    @InjectModel(RegistrationRequest.name)
    private readonly requestModel: Model<RegistrationRequestDocument>,
    private readonly institutionsService: InstitutionsService,
    private readonly participantsService: ParticipantsService,
    private readonly staffService: StaffService,
    private readonly usersService: UsersService,
    private readonly dynamicFieldsValidator: DynamicFieldsValidatorService,
    private readonly fieldDefinitionsService: FieldDefinitionsService,
  ) {}

  /**
   * Shared guard for every public/unauthenticated entry point on this
   * service (submit, getPublicFields): the institution must exist, be
   * Active, and have self-registration turned on. Extracted so the new
   * public field-metadata endpoint can't be used to probe institutions that
   * aren't actually accepting registrations.
   */
  private async assertSelfRegistrationOpen(institutionId: string) {
    const institution = await this.institutionsService
      .getMe(institutionId)
      .catch(() => null);
    if (
      !institution ||
      institution.institution.status !== InstitutionStatus.Active
    ) {
      throw AppError.notFound(
        'Institution not found or not accepting registrations',
        'INSTITUTION_NOT_FOUND',
      );
    }
    if (!institution.settings?.selfRegistrationEnabled) {
      throw AppError.forbidden(
        'Self-registration is disabled for this institution',
        'SELF_REGISTRATION_DISABLED',
      );
    }
  }

  /**
   * Two duplicate cases, checked in order of likelihood:
   * 1. Someone with this exact name is already an approved Participant/
   *    Staff member of this institution — most likely they already went
   *    through this once and forgot their login, not a genuine second
   *    person who happens to share a name.
   * 2. There's already a Pending request with this exact name/entityType —
   *    most likely an accidental double-submit, not a race between two
   *    different people.
   * Exact (case-insensitive, trimmed) match only — not fuzzy/typo-tolerant,
   * so two unrelated people who legitimately share a name will still both
   * get through and land in front of an Admin to sort out manually, same
   * as before this existed.
   */
  private async assertNoDuplicate(
    institutionId: string,
    entityType: FieldEntityType.Participant | FieldEntityType.Staff,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const alreadyApproved =
      entityType === FieldEntityType.Staff
        ? await this.staffService.existsByName(
            institutionId,
            firstName,
            lastName,
          )
        : await this.participantsService.existsByName(
            institutionId,
            firstName,
            lastName,
          );
    if (alreadyApproved) {
      throw AppError.conflict(
        'A record with this name already exists at this institution. If this is you, contact the institution for your login details instead of registering again.',
        'DUPLICATE_NAME',
      );
    }

    const pendingDuplicate = await this.requestModel
      .exists({
        institutionId,
        entityType,
        status: RegistrationRequestStatus.Pending,
        'requestedData.firstName': new RegExp(
          `^${escapeRegex(firstName.trim())}$`,
          'i',
        ),
        'requestedData.lastName': new RegExp(
          `^${escapeRegex(lastName.trim())}$`,
          'i',
        ),
      })
      .exec();
    if (pendingDuplicate) {
      throw AppError.conflict(
        'A pending registration request with this name already exists. Please wait for the institution to respond instead of submitting again.',
        'DUPLICATE_PENDING_REQUEST',
      );
    }
  }

  /**
   * POST /registration-requests. Spec sections 13, 84. Public — the
   * submitter is not authenticated, so institutionId travels in the body
   * (documented exception, see the DTO's comment).
   */
  async submit(
    dto: SubmitRegistrationRequestDto,
  ): Promise<RegistrationRequestDocument> {
    await this.assertSelfRegistrationOpen(dto.institutionId);
    const entityType = dto.entityType ?? FieldEntityType.Participant;

    // Duplicate detection (spec 13.1 originally documented this as
    // "left to manual admin review" — v1 shipped with none at all. Added
    // per explicit product request: catches the two realistic cases
    // (already-approved person re-registering because they forgot their
    // credentials, and an accidental double-submit of the same pending
    // request) without being a fuzzy/typo-tolerant matcher — same name,
    // same institution, same entity type, exact (case-insensitive) match.
    await this.assertNoDuplicate(
      dto.institutionId,
      entityType,
      dto.firstName,
      dto.lastName,
    );

    // Dynamic-field validation (spec 36-37: unknown-key rejection, type/
    // required checks, field-level write permission) was previously never
    // run on self-registration submissions — bad data only surfaced later,
    // confusingly, when an Admin tried to approve() it. The submitter isn't
    // authenticated and has no Role of their own, but the data becomes a
    // Participant/Staff record on approval, so we validate against that
    // entity type's FieldDefinition.permissions — the same permission that
    // governs a Participant editing their own record post-registration
    // (spec 21), extended here to Staff self-registration on the same
    // reasoning (permissions.staff describes STAFF-role self-edit on a
    // Staff-entityType field, mirroring permissions.participant). See
    // PROGRESS.md open decisions.
    await this.dynamicFieldsValidator.validate({
      institutionId: dto.institutionId,
      entityType,
      role: selfRoleFor(entityType),
      customFields: dto.customFields ?? [],
    });

    return this.requestModel.create({
      institutionId: dto.institutionId,
      entityType,
      requestedData: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        customFields: dto.customFields ?? [],
      },
      status: RegistrationRequestStatus.Pending,
    });
  }

  /**
   * GET /registration-requests/fields — public. Lets the join form render
   * the institution's configured custom fields for the chosen entity type,
   * limited to fields that role is actually allowed to self-edit (mirrors
   * the write-permission check in validate() above, plus Select/MultiSelect
   * options so the form can render a dropdown without a second, admin-gated
   * call to GET /field-options).
   */
  async getPublicFields(
    query: PublicFieldsQueryDto,
  ): Promise<PublicFieldMeta[]> {
    await this.assertSelfRegistrationOpen(query.institutionId);
    // Shared with the authenticated "edit my profile" endpoint
    // (GET /users/me/fields) — see FieldDefinitionsService for the identical
    // self-edit-permission logic factored out from here.
    return this.fieldDefinitionsService.findSelfEditableFields(
      query.institutionId,
      query.entityType,
      selfRoleFor(query.entityType),
    );
  }

  /** GET /registration-requests. Spec section 84 — Administrator only. */
  async findAll(
    institutionId: string,
    query: QueryRegistrationRequestsDto,
  ): Promise<PaginatedResult<RegistrationRequestDocument>> {
    const { page, limit, status } = query;
    const filter: Record<string, unknown> = { institutionId };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);
    return { items, page, limit, total };
  }

  /**
   * POST /registration-requests/:id/approve. Spec section 15: creates the
   * Participant (or, for a Staff self-registration, the Staff record),
   * copies the approved data, optionally creates a User, and marks the
   * request approved.
   */
  async approve(
    id: string,
    institutionId: string,
    dto: ApproveRegistrationRequestDto,
  ): Promise<{
    requestId: string;
    entityType: FieldEntityType.Participant | FieldEntityType.Staff;
    participantId?: string;
    staffId?: string;
    username?: string;
    tempPassword?: string;
  }> {
    const request = await this.getPending(id, institutionId);
    const entityType = request.entityType ?? FieldEntityType.Participant;

    if (entityType === FieldEntityType.Staff) {
      return this.approveStaff(request, institutionId, dto);
    }
    return this.approveParticipant(request, institutionId, dto);
  }

  private async approveParticipant(
    request: RegistrationRequestDocument,
    institutionId: string,
    dto: ApproveRegistrationRequestDto,
  ) {
    const settings = await this.institutionsService.getSettings(institutionId);

    const participant = await this.participantsService.create(institutionId, {
      firstName: request.requestedData.firstName,
      lastName: request.requestedData.lastName,
      customFields: request.requestedData.customFields,
    });

    let username: string | undefined;
    let tempPassword: string | undefined;
    const shouldCreateUser =
      settings.participantUserMode === ParticipantUserMode.Always ||
      (settings.participantUserMode === ParticipantUserMode.Optional &&
        dto.createUser === true);

    if (shouldCreateUser) {
      const login = await this.createLoginFor(
        institutionId,
        request.requestedData.firstName,
        request.requestedData.lastName,
        Role.Participant,
        { participantId: participant._id },
      );
      username = login.username;
      tempPassword = login.tempPassword;
    }

    request.status = RegistrationRequestStatus.Approved;
    await request.save();

    return {
      requestId: request._id.toString(),
      entityType: FieldEntityType.Participant as const,
      participantId: participant._id.toString(),
      username,
      tempPassword,
    };
  }

  /**
   * Staff self-registration has no institution-level "always/never/optional"
   * mode like participantUserMode — staff accounts are ordinarily
   * admin-created (spec 70), so a login is only created here when the
   * approving Administrator explicitly opts in via createUser:true. No
   * "Always" auto-create for staff, unlike participants.
   */
  private async approveStaff(
    request: RegistrationRequestDocument,
    institutionId: string,
    dto: ApproveRegistrationRequestDto,
  ) {
    const staff = await this.staffService.create(institutionId, {
      firstName: request.requestedData.firstName,
      lastName: request.requestedData.lastName,
      customFields: request.requestedData.customFields,
    });

    let username: string | undefined;
    let tempPassword: string | undefined;
    if (dto.createUser === true) {
      const login = await this.createLoginFor(
        institutionId,
        request.requestedData.firstName,
        request.requestedData.lastName,
        Role.Staff,
        { staffId: staff._id },
      );
      username = login.username;
      tempPassword = login.tempPassword;
    }

    request.status = RegistrationRequestStatus.Approved;
    await request.save();

    return {
      requestId: request._id.toString(),
      entityType: FieldEntityType.Staff as const,
      staffId: staff._id.toString(),
      username,
      tempPassword,
    };
  }

  private async createLoginFor(
    institutionId: string,
    firstName: string,
    lastName: string,
    role: Role,
    link: { participantId?: Types.ObjectId; staffId?: Types.ObjectId },
  ): Promise<{ username: string; tempPassword: string }> {
    const username = await this.generateUsername(
      institutionId,
      firstName,
      lastName,
    );
    // Temp password = first+last name concatenated, no separator (explicit
    // product decision, same reasoning as the username: memorable over
    // secure-by-obscurity for this onboarding step). This is genuinely
    // guessable by anyone who knows the person's name — mustChangePassword
    // below is what actually keeps the account safe, forcing a real secret
    // to be set before anything else works (enforced globally by
    // MustChangePasswordGuard, not just a UI nicety).
    const tempPassword = `${firstName}${lastName}`;
    const passwordHash = await hashPassword(tempPassword);
    await this.usersService.createRaw({
      institutionId,
      username,
      passwordHash,
      role,
      ...link,
      mustChangePassword: true,
    });
    return { username, tempPassword };
  }

  /** POST /registration-requests/:id/reject. Spec section 15. */
  async reject(id: string, institutionId: string): Promise<void> {
    const request = await this.getPending(id, institutionId);
    request.status = RegistrationRequestStatus.Rejected;
    await request.save();
  }

  private async getPending(
    id: string,
    institutionId: string,
  ): Promise<RegistrationRequestDocument> {
    const request = await this.requestModel
      .findOne({ _id: id, institutionId })
      .exec();
    if (!request) {
      throw AppError.notFound(
        'Registration request not found',
        'REGISTRATION_REQUEST_NOT_FOUND',
      );
    }
    if (request.status !== RegistrationRequestStatus.Pending) {
      throw AppError.conflict(
        'Registration request already reviewed',
        'ALREADY_REVIEWED',
      );
    }
    return request;
  }

  /**
   * Username = the person's real name ("שם המשתמש יהיה השם של המשתמש" —
   * explicit product decision, prioritizing something a student/staff
   * member will actually remember over machine-generated obscurity).
   *
   * Bug fixed here as a side effect: the old scheme lowercased and stripped
   * everything outside [a-z0-9.], which silently discarded Hebrew entirely
   * — every Hebrew-named registrant landed on the "participant.xxxx"
   * fallback with no trace of their real name. Not caught earlier because
   * every login created via this flow in this session used ASCII test
   * names. Institution-scoped uniqueness still enforced (a numeric suffix
   * is appended only on an actual collision, not by default).
   */
  private async generateUsername(
    institutionId: string,
    firstName: string,
    lastName: string,
  ): Promise<string> {
    const base = `${firstName} ${lastName}`.trim() || 'user';
    let candidate = base;
    let attempt = 2;
    while (await this.usersService.usernameExists(institutionId, candidate)) {
      candidate = `${base} ${attempt}`;
      attempt += 1;
    }
    return candidate;
  }
}
