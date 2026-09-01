import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FieldEntityType, Role } from '../../common/enums';
import { AppError } from '../../common/errors/app-error';
import { AuthenticatedUser, PaginatedResult } from '../../common/interfaces';
import { escapeRegex } from '../../common/utils/regex.util';
import { DynamicFieldsValidatorService } from '../dynamic-fields/dynamic-fields-validator.service';
import { DynamicQueryService } from '../dynamic-fields/dynamic-query.service';
import {
  StaffGroup,
  StaffGroupDocument,
} from '../staff-groups/schemas/staff-group.schema';
import { UsersService } from '../users/users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { Staff, StaffDocument } from './schemas/staff.schema';

/** System (non-dynamic) fields sortable via a plain index-backed sort. Spec 60. */
const SYSTEM_SORT_FIELDS = new Set(['firstName', 'lastName', 'createdAt']);

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(StaffGroup.name)
    private readonly staffGroupModel: Model<StaffGroupDocument>,
    private readonly dynamicFieldsValidator: DynamicFieldsValidatorService,
    private readonly dynamicQueryService: DynamicQueryService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    institutionId: string,
    dto: CreateStaffDto,
    actingRole: Role = Role.Admin,
  ): Promise<StaffDocument> {
    await this.dynamicFieldsValidator.validate({
      institutionId,
      entityType: FieldEntityType.Staff,
      role: actingRole,
      customFields: dto.customFields ?? [],
    });
    return this.staffModel.create({
      institutionId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      customFields: dto.customFields ?? [],
    });
  }

  /** GET /staff — pagination plus dynamic-field filter/sort (spec 38-40, 76). */
  async findAll(
    institutionId: string,
    query: QueryStaffDto,
    actingRole: Role = Role.Admin,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, limit, search, filters, sortBy, sortDir, groupId } = query;
    const filter: Record<string, unknown> = { institutionId, isDeleted: false };
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }];
    }
    if (groupId) {
      const memberships = await this.staffGroupModel
        .find({ institutionId, groupId })
        .select('staffId')
        .exec();
      filter._id = { $in: memberships.map((m) => m.staffId) };
    }
    const [{ items: rawItems, total }, viewableKeys] = await Promise.all([
      this.dynamicQueryService.findAll(
        this.staffModel,
        institutionId,
        FieldEntityType.Staff,
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
        FieldEntityType.Staff,
        actingRole,
      ),
    ]);
    const items = rawItems.map((doc) =>
      this.toReadable(
        doc as StaffDocument | Record<string, unknown>,
        viewableKeys,
      ),
    );
    return { items, page, limit, total };
  }

  /**
   * GET /staff/:id. Now self-scoped for STAFF too (previously Admin-only —
   * a STAFF-role user had zero access to their own record, unlike
   * Participant which already supported self-view/edit). Same pattern as
   * ParticipantsService: findOneRaw() enforces access, then results go
   * through the same field-level READ filtering as an Admin's view.
   */
  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const staff = await this.findOneRaw(id, user);
    const viewableKeys = await this.dynamicFieldsValidator.getViewableKeys(
      this.requireInstitution(user),
      FieldEntityType.Staff,
      user.role,
    );
    return this.toReadable(staff, viewableKeys);
  }

  /** PUT /staff/:id. Self-scoped for STAFF (see findOne); field write-permission still enforced per field. */
  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateStaffDto,
  ): Promise<Record<string, unknown>> {
    await this.findOneRaw(id, user);
    const institutionId = this.requireInstitution(user);
    await this.dynamicFieldsValidator.validate({
      institutionId,
      entityType: FieldEntityType.Staff,
      role: user.role,
      customFields: dto.customFields,
    });
    const staff = await this.staffModel
      .findOneAndUpdate(
        { _id: id, institutionId, isDeleted: false },
        { $set: dto },
        { new: true },
      )
      .exec();
    if (!staff) throw AppError.notFound('Staff not found', 'STAFF_NOT_FOUND');
    const viewableKeys = await this.dynamicFieldsValidator.getViewableKeys(
      institutionId,
      FieldEntityType.Staff,
      user.role,
    );
    return this.toReadable(staff, viewableKeys);
  }

  /** Internal fetch with access check — used by findOne/update. */
  private async findOneRaw(
    id: string,
    user: AuthenticatedUser,
  ): Promise<StaffDocument> {
    const institutionId = this.requireInstitution(user);
    const staff = await this.staffModel
      .findOne({ _id: id, institutionId, isDeleted: false })
      .exec();
    if (!staff) throw AppError.notFound('Staff not found', 'STAFF_NOT_FOUND');
    if (user.role === Role.Staff) {
      const ownId = await this.resolveOwnStaffId(user);
      if (!ownId || ownId !== staff._id.toString()) {
        throw AppError.forbidden(
          'Can only access your own record',
          'OUT_OF_SCOPE',
        );
      }
    }
    return staff;
  }

  /** Case-insensitive exact name match — mirrors ParticipantsService.existsByName. */
  async existsByName(
    institutionId: string,
    firstName: string,
    lastName: string,
  ): Promise<boolean> {
    const exists = await this.staffModel
      .exists({
        institutionId,
        isDeleted: false,
        firstName: new RegExp(`^${escapeRegex(firstName.trim())}$`, 'i'),
        lastName: new RegExp(`^${escapeRegex(lastName.trim())}$`, 'i'),
      })
      .exec();
    return !!exists;
  }

  /** Resolves the Staff record linked to a STAFF-role User (mirrors resolveOwnParticipantId). */
  private async resolveOwnStaffId(
    user: AuthenticatedUser,
  ): Promise<string | null> {
    const record = await this.usersService.findByIdForAuth(user.userId);
    return record?.staffId ? record.staffId.toString() : null;
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

  /**
   * Applies field-level READ filtering (spec 21) to a document destined for
   * an API response. Accepts either a Mongoose document (from .find()) or a
   * plain object (from .aggregate(), used by dynamic-field sorting) since
   * aggregate results never have Mongoose document methods.
   */
  private toReadable(
    doc: StaffDocument | Record<string, unknown>,
    viewableKeys: Set<string> | null,
  ): Record<string, unknown> {
    const obj = (typeof (doc as StaffDocument).toObject === 'function'
      ? (doc as StaffDocument).toObject()
      : doc) as unknown as Record<string, unknown> & {
      customFields: { k: string; v: unknown }[];
    };
    obj.customFields = this.dynamicFieldsValidator.filterByViewableKeys(
      obj.customFields,
      viewableKeys,
    );
    return obj;
  }

  /** Soft delete. Spec section 59. */
  async softDelete(id: string, institutionId: string): Promise<void> {
    const res = await this.staffModel
      .findOneAndUpdate(
        { _id: id, institutionId, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() },
      )
      .exec();
    if (!res) throw AppError.notFound('Staff not found', 'STAFF_NOT_FOUND');
  }

  /** Used by StaffGroups to verify a same-tenant reference (spec 58.1). */
  async assertExists(id: string, institutionId: string): Promise<void> {
    const exists = await this.staffModel
      .exists({ _id: id, institutionId, isDeleted: false })
      .exec();
    if (!exists) throw AppError.notFound('Staff not found', 'STAFF_NOT_FOUND');
  }
}
