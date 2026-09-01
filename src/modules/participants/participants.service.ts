import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FieldEntityType, Role } from '../../common/enums';
import { AppError } from '../../common/errors/app-error';
import { AuthenticatedUser, PaginatedResult } from '../../common/interfaces';
import { escapeRegex } from '../../common/utils/regex.util';
import { DynamicFieldsValidatorService } from '../dynamic-fields/dynamic-fields-validator.service';
import { DynamicQueryService } from '../dynamic-fields/dynamic-query.service';
import { InstitutionsService } from '../institutions/institutions.service';
import {
  ParticipantGroup,
  ParticipantGroupDocument,
} from '../participant-groups/schemas/participant-group.schema';
import {
  StaffGroup,
  StaffGroupDocument,
} from '../staff-groups/schemas/staff-group.schema';
import { UsersService } from '../users/users.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { QueryParticipantsDto } from './dto/query-participants.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant, ParticipantDocument } from './schemas/participant.schema';

/** System (non-dynamic) fields sortable via a plain index-backed sort. Spec 60. */
const SYSTEM_SORT_FIELDS = new Set(['firstName', 'lastName', 'createdAt']);

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectModel(Participant.name)
    private readonly participantModel: Model<ParticipantDocument>,
    @InjectModel(ParticipantGroup.name)
    private readonly participantGroupModel: Model<ParticipantGroupDocument>,
    @InjectModel(StaffGroup.name)
    private readonly staffGroupModel: Model<StaffGroupDocument>,
    private readonly institutionsService: InstitutionsService,
    private readonly usersService: UsersService,
    private readonly dynamicFieldsValidator: DynamicFieldsValidatorService,
    private readonly dynamicQueryService: DynamicQueryService,
  ) {}

  /** POST /participants. Spec section 71 (Administrator, or Staff per settings). */
  async create(
    institutionId: string,
    dto: CreateParticipantDto,
    actingRole: Role = Role.Admin,
  ): Promise<ParticipantDocument> {
    await this.dynamicFieldsValidator.validate({
      institutionId,
      entityType: FieldEntityType.Participant,
      role: actingRole,
      customFields: dto.customFields ?? [],
    });
    return this.participantModel.create({
      institutionId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      customFields: dto.customFields ?? [],
    });
  }

  /**
   * GET /participants — pagination, search (system fields), groupId filter,
   * plus dynamic-field filter/sort (spec 72, 85, 38-40).
   */
  async findAll(
    user: AuthenticatedUser,
    query: QueryParticipantsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const institutionId = this.requireInstitution(user);
    const { page, limit, search, groupId, filters, sortBy, sortDir } = query;
    const filter: Record<string, unknown> = { institutionId, isDeleted: false };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }];
    }

    if (groupId) {
      const ids = await this.activeParticipantIdsInGroup(
        institutionId,
        groupId,
      );
      filter._id = { $in: ids };
    }

    await this.applyContextScope(user, filter);

    // Dynamic filter/sort + field metadata lookup shared with Staff/Groups
    // (spec 38-40) — see DynamicQueryService. viewableKeys (spec 21
    // field-level READ) is fetched in parallel since it's independent.
    const [{ items: rawItems, total }, viewableKeys] = await Promise.all([
      this.dynamicQueryService.findAll(
        this.participantModel,
        institutionId,
        FieldEntityType.Participant,
        filter,
        {
          page,
          limit,
          filters,
          sortBy,
          sortDir,
          systemSortFields: SYSTEM_SORT_FIELDS,
        },
      ),
      this.dynamicFieldsValidator.getViewableKeys(
        institutionId,
        FieldEntityType.Participant,
        user.role,
      ),
    ]);

    const items = rawItems.map((doc) =>
      this.toReadable(
        doc as ParticipantDocument | Record<string, unknown>,
        viewableKeys,
      ),
    );
    return { items, page, limit, total };
  }

  /** GET /participants/:id. Spec section 73. */
  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const participant = await this.findOneRaw(id, user);
    const viewableKeys = await this.dynamicFieldsValidator.getViewableKeys(
      this.requireInstitution(user),
      FieldEntityType.Participant,
      user.role,
    );
    return this.toReadable(participant, viewableKeys);
  }

  /** PUT /participants/:id. Spec section 74 (entity + field permission checks happen upstream). */
  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateParticipantDto,
  ): Promise<Record<string, unknown>> {
    // Load first so we can enforce context-aware access before writing (spec 519, 833).
    await this.findOneRaw(id, user);
    const institutionId = this.requireInstitution(user);
    await this.dynamicFieldsValidator.validate({
      institutionId,
      entityType: FieldEntityType.Participant,
      role: user.role,
      customFields: dto.customFields,
    });
    const participant = await this.participantModel
      .findOneAndUpdate(
        { _id: id, institutionId, isDeleted: false },
        { $set: dto },
        { new: true },
      )
      .exec();
    if (!participant)
      throw AppError.notFound('Participant not found', 'PARTICIPANT_NOT_FOUND');
    const viewableKeys = await this.dynamicFieldsValidator.getViewableKeys(
      institutionId,
      FieldEntityType.Participant,
      user.role,
    );
    return this.toReadable(participant, viewableKeys);
  }

  /** Internal fetch (raw document, no field filtering) — used by findOne/update for access checks. */
  private async findOneRaw(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ParticipantDocument> {
    const institutionId = this.requireInstitution(user);
    const participant = await this.participantModel
      .findOne({ _id: id, institutionId, isDeleted: false })
      .exec();
    if (!participant)
      throw AppError.notFound('Participant not found', 'PARTICIPANT_NOT_FOUND');
    await this.assertAccessible(user, participant);
    return participant;
  }

  /**
   * Applies field-level READ filtering (spec 21) to a document destined for
   * an API response. Accepts either a Mongoose document (from .find()) or a
   * plain object (from .aggregate(), used by dynamic-field sorting) since
   * aggregate results never have Mongoose document methods.
   */
  private toReadable(
    doc: ParticipantDocument | Record<string, unknown>,
    viewableKeys: Set<string> | null,
  ): Record<string, unknown> {
    const obj = (typeof (doc as ParticipantDocument).toObject === 'function'
      ? (doc as ParticipantDocument).toObject()
      : doc) as unknown as Record<string, unknown> & {
      customFields: { k: string; v: unknown }[];
    };
    obj.customFields = this.dynamicFieldsValidator.filterByViewableKeys(
      obj.customFields,
      viewableKeys,
    );
    return obj;
  }

  /** DELETE /participants/:id — soft delete. Spec sections 59, 75. */
  async softDelete(id: string, institutionId: string): Promise<void> {
    const res = await this.participantModel
      .findOneAndUpdate(
        { _id: id, institutionId, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() },
      )
      .exec();
    if (!res)
      throw AppError.notFound('Participant not found', 'PARTICIPANT_NOT_FOUND');
  }

  /** Used by ParticipantGroups to verify a same-tenant reference (spec 58.1). */
  async assertExists(id: string, institutionId: string): Promise<void> {
    const exists = await this.participantModel
      .exists({ _id: id, institutionId, isDeleted: false })
      .exec();
    if (!exists)
      throw AppError.notFound('Participant not found', 'PARTICIPANT_NOT_FOUND');
  }

  /**
   * Case-insensitive exact name match, used by self-registration duplicate
   * detection (RegistrationRequestsService) — not a fuzzy/typo-tolerant
   * check, just enough to catch "I already registered, let me try again"
   * or an admin re-approving the same person twice.
   */
  async existsByName(
    institutionId: string,
    firstName: string,
    lastName: string,
  ): Promise<boolean> {
    const exists = await this.participantModel
      .exists({
        institutionId,
        isDeleted: false,
        firstName: new RegExp(`^${escapeRegex(firstName.trim())}$`, 'i'),
        lastName: new RegExp(`^${escapeRegex(lastName.trim())}$`, 'i'),
      })
      .exec();
    return !!exists;
  }

  /**
   * Context-aware relationship scoping (spec 519, 833):
   * STAFF only sees Participants in groups they're assigned to via
   * StaffGroup, when the institution has staffGroupManagementEnabled.
   * PARTICIPANT only sees their own record (spec 11) — enforced by the
   * caller via the linked participantId on the JWT-resolved User.
   */
  private async applyContextScope(
    user: AuthenticatedUser,
    filter: Record<string, unknown>,
  ): Promise<void> {
    if (user.role === Role.Participant) {
      const ownId = await this.resolveOwnParticipantId(user);
      filter._id = ownId ? { $in: [ownId] } : { $in: [] };
      return;
    }
    if (user.role !== Role.Staff) return;
    const institutionId = this.requireInstitution(user);
    const settings = await this.institutionsService.getSettings(institutionId);
    if (!settings.staffGroupManagementEnabled) return;

    const staffGroups = await this.staffGroupModel
      .find({ institutionId, staffId: user.userId })
      .select('groupId')
      .exec();
    const groupIds = staffGroups.map((sg) => sg.groupId);

    if (groupIds.length === 0) {
      // Assigned to no group: sees nothing rather than everything.
      filter._id = { $in: [] };
      return;
    }

    const memberships = await this.participantGroupModel
      .find({ institutionId, groupId: { $in: groupIds }, active: true })
      .select('participantId')
      .exec();
    const allowedIds = memberships.map((m) => m.participantId.toString());

    const existing = filter._id as { $in?: unknown[] } | undefined;
    if (existing?.$in) {
      const requested = new Set(existing.$in.map((x) => String(x)));
      filter._id = { $in: allowedIds.filter((id) => requested.has(id)) };
    } else {
      filter._id = { $in: allowedIds };
    }
  }

  private async assertAccessible(
    user: AuthenticatedUser,
    participant: ParticipantDocument,
  ): Promise<void> {
    if (user.role === Role.Participant) {
      const ownId = await this.resolveOwnParticipantId(user);
      if (!ownId || ownId !== participant._id.toString()) {
        throw AppError.forbidden(
          'Can only access your own record',
          'OUT_OF_SCOPE',
        );
      }
      return;
    }
    if (user.role !== Role.Staff) return;
    const institutionId = this.requireInstitution(user);
    const settings = await this.institutionsService.getSettings(institutionId);
    if (!settings.staffGroupManagementEnabled) return;

    const staffGroups = await this.staffGroupModel
      .find({ institutionId, staffId: user.userId })
      .select('groupId')
      .exec();
    const groupIds = staffGroups.map((sg) => sg.groupId);
    if (groupIds.length === 0) {
      throw AppError.forbidden(
        'Not assigned to this participant’s group',
        'OUT_OF_SCOPE',
      );
    }

    const isMember = await this.participantGroupModel
      .exists({
        institutionId,
        participantId: participant._id,
        groupId: { $in: groupIds },
        active: true,
      })
      .exec();
    if (!isMember) {
      throw AppError.forbidden(
        'Not assigned to this participant’s group',
        'OUT_OF_SCOPE',
      );
    }
  }

  /** Resolves the Participant linked to a PARTICIPANT-role User (spec 11, 48). */
  private async resolveOwnParticipantId(
    user: AuthenticatedUser,
  ): Promise<string | null> {
    const record = await this.usersService.findByIdForAuth(user.userId);
    return record?.participantId ? record.participantId.toString() : null;
  }

  private async activeParticipantIdsInGroup(
    institutionId: string,
    groupId: string,
  ) {
    const memberships = await this.participantGroupModel
      .find({ institutionId, groupId, active: true })
      .select('participantId')
      .exec();
    return memberships.map((m) => m.participantId);
  }

  private requireInstitution(user: AuthenticatedUser): string {
    if (!user.institutionId) {
      throw AppError.forbidden(
        'Action requires an institution-scoped user',
        'NO_INSTITUTION',
      );
    }
    return user.institutionId;
  }
}
