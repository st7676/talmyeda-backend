# Talmyeda Backend — מצב התקדמות (Progress Tracker)

> מקור האמת למה נבנה, מה בעבודה, ומה הבא בתור.
> **לפני כל עבודה** קראו את הסקיל [`.claude/skills/talmyeda-workflow/SKILL.md`](.claude/skills/talmyeda-workflow/SKILL.md).
> אפיון מלא: [`SPEC.md.DOC`](SPEC.md.DOC).

מקרא סטטוסים: `✅ הושלם` · `🔧 בעבודה` · `⏸️ חלקי` · `⬜ טרם התחיל`

---

## תשתית (Foundation)

| רכיב | סעיף אפיון | סטטוס | הערות |
|------|-----------|-------|-------|
| Scaffold NestJS + Mongoose + Config + Validation | 4, 100 | ✅ הושלם | קיים מה-commit הראשוני |
| מבנה תגובה אחיד (success/data, error) | 65 | ✅ הושלם | `ResponseInterceptor` + `AllExceptionsFilter` + `AppError` |
| טיפוסים משותפים / enums (Role, Status, FieldType...) | 8, 28 | ✅ הושלם | `src/common/**` |
| חיבור MongoDB | 43 | ✅ הושלם | `DatabaseModule` |

## אימות והרשאות (Auth & Security)

| רכיב | סעיף אפיון | סטטוס | הערות |
|------|-----------|-------|-------|
| User schema (auth בלבד, נפרד מ-business) | 48, 7 | ✅ הושלם | `src/modules/users` |
| Login + JWT + bcrypt | 66-68, 90 | ✅ הושלם | `src/modules/auth` |
| JwtAuthGuard | 93 | ✅ הושלם | + `@Public()` decorator |
| Tenant scoping (institutionId מה-JWT) | 44, 92, 93 | ✅ הושלם | `@CurrentUser()` + guard מזריק scope |
| CASL Ability Factory + Guard (ABAC) | 20-21, 93 | ✅ הושלם | entity-level (`CaslAbilityGuard`+`@CheckAbility`) + context-aware group scoping ב-`ParticipantsService` |
| mustChangePassword flow | 70.1 | ✅ הושלם | `MustChangePasswordGuard` גלובלי — חוסם כל route (חוץ מ-`@Public`/`@SkipMustChangePasswordCheck`) עד שינוי סיסמה |
| Rate limiting (login, registration) | 90.1 | ✅ הושלם | `@nestjs/throttler`: ברירת מחדל 100/דקה גלובלי, login 10/דקה + נעילת חשבון per-username, registration-requests 5/דקה |

## ישויות ליבה (Core Entities & CRUD)

| מודול | סעיף אפיון | סטטוס | הערות |
|-------|-----------|-------|-------|
| Institution + InstitutionSettings + register | 46-47, 69 | ✅ הושלם | register יוצר Institution+Admin User+Settings |
| Platform (SUPER_ADMIN) approve/suspend/reactivate/reject | 69.1 | ✅ הושלם | `platform.controller.ts`, `@Roles(SuperAdmin)` |
| Users API (CRUD, soft delete, change-password) | 70, 70.1 | ✅ הושלם | controller מלא + temp password + mustChangePassword |
| Participants API (CRUD, pagination, search) | 71-75, 49 | ✅ הושלם | + group-scoping ל-STAFF, self-scoping ל-PARTICIPANT |
| Staff API | 76, 50 | ✅ הושלם | Admin-only CRUD + soft delete |
| Groups API | 77, 51 | ✅ הושלם | CRUD + soft delete |
| ParticipantGroup (+ היסטוריה) | 78, 52, 18 | ✅ הושלם | assign/deactivate (active=false+endDate, לא מחיקה פיזית) |
| StaffGroup | 79, 53 | ✅ הושלם | assign/remove |
| RegistrationRequest + approve/reject | 84, 13-15 | ✅ הושלם | submit (public) + list/approve/reject (Admin); approve יוצר Participant ומשתמש אופציונלי לפי `participantUserMode` |

## מנוע סכימה דינמית (Dynamic Schema Engine)

| רכיב | סעיף אפיון | סטטוס | הערות |
|------|-----------|-------|-------|
| FieldDefinition CRUD | 25-32, 80-82 | ✅ הושלם | internalKey אוטומטי; type-change ו-required-change עוברים בדיקות בטיחות מול דאטה קיים לפני יישום |
| FieldOption CRUD (isActive) | 33-34, 83 | ✅ הושלם | disable (לא מחיקה פיזית) + institutionId denormalized |
| customFields Attribute Pattern `[{k,v}]` | 35 | ✅ הושלם | canonical בכל הישויות (Participant/Staff/Group/RegistrationRequest) |
| DynamicValidationPipe (type/required/unknown) | 36-37, 94.3 | ✅ הושלם | `DynamicFieldsValidatorService` — נאכף ב-create/update של Participant/Staff/Group, וגם ב-`submit()` הציבורי של RegistrationRequest (role=Participant, נוסף 2026-08-13) |
| Dynamic search / filter / sort | 38-40, 72, 85 | ✅ הושלם (Participants+Staff+Groups) | `?filters={"field_x":"y"}` (רק filterable), `?sortBy=&sortDir=` (רק sortable; שדה דינמי → aggregation pipeline), `?search=` (free-text על שדות מערכת, regex `$or` case-insensitive). לוגיקה משותפת חולצה ל-`DynamicQueryService`; `escapeRegex` משותף ב-`common/utils/regex.util.ts` (2026-08-15, גם Staff/Groups קיבלו `search` — היה חסר בפועל, לא רק לא-מתועד, לפי סקירת האפיון המלאה). `groupId` נשאר ספציפי ל-Participants בלבד |
| אינדקסים מורכבים ל-customFields | 60-61 | ✅ הושלם | `{institutionId, customFields.k, customFields.v}` בכל schema רלוונטי |

## איכות ותשתיות (Cross-cutting)

| רכיב | סעיף אפיון | סטטוס | הערות |
|------|-----------|-------|-------|
| Soft delete (isDeleted/deletedAt) | 59 | ✅ הושלם | User, Institution, Participant, Staff, Group |
| Pagination אחיד | 86, 98.1 | ✅ הושלם | `PaginationQueryDto` + `PaginatedResult<T>` בכל ה-list endpoints |
| Logging | 96 | ✅ הושלם | `LoggingInterceptor` גלובלי (method+path+duration+actor על כל בקשה מוצלחת) + לוג מפורש ל-login מוצלח/כושל ב-`AuthService` (WARN לכושל, LOG למוצלח — כנדרש בסעיף 96 "Failed authentication attempts"). שגיאות 500+ ממשיכות להירשם ע"י `AllExceptionsFilter` הקיים. **אומת בפועל דרך Docker** — נראה בלוגים: `[HTTP] POST /auth/login...`, `[AuthService] Failed login attempt...`/`Successful login...` |
| Docker (backend + mongo) | 101 | ✅ הושלם | `Dockerfile` (multi-stage build), `docker-compose.yml` (backend+mongo+healthcheck+volume), `.dockerignore`. **אומת בפועל** — `docker compose up` הורץ עד הסוף מול MongoDB אמיתי (ראו סעיף הבאג הקריטי למטה) |
| טסטים (unit/integration/security) | 102 | ✅ הושלם | `npm run test:integration` — 38 טסטים אוטומטיים מול MongoDB אמיתי (in-memory, לא mock) דרך `mongodb-memory-server`, ב-7 קבצים: functional (5) + security (9, סעיף 102.3) + dynamic sort/filter Participants (6, סעיף 38-40) + dynamic sort/filter Staff/Groups (8) + RegistrationRequest field validation (5, סעיפים 13/21/36-37) + free-text search Staff/Groups (5, סעיפים 72/85). **תפס 2 באגים אמיתיים נוספים** (#2 ו-#3, ראו למטה) בכתיבה הראשונה שלהם, לא רק ב"בדיקת בדיקה" — ההוכחה הטובה ביותר שהתשתית הזו עובדת |

---

## 🚨 באג קריטי שנמצא ותוקן (2026-08-10)

**נמצא רק דרך בדיקה אמיתית מול MongoDB (Docker) — בדיוק הסיבה שסעיף 102 חשוב.**

**מה היה שבור:** בכל 10 קבצי ה-schema בפרויקט, שדות ObjectId (`institutionId`,
`participantId`, `staffId`, `groupId`, `fieldId` וכו') הוגדרו כך:
```ts
import { Types } from 'mongoose';
@Prop({ type: Types.ObjectId, ref: 'Institution', ... })
```
`Types.ObjectId` הוא מחלקת ה-**BSON ObjectId עצמה** (ליצירת instance), **לא**
`Schema.Types.ObjectId`/`SchemaTypes.ObjectId` שזה מה ש-Mongoose צריך כדי לדעת
את **סוג השדה בסכימה**. Mongoose לא זיהה את זה, הגדיר את השדה כ-`Mixed`, ואיבד
את ה-cast האוטומטי string↔ObjectId.

**איך זה התבטא בפועל:** שדה שנכתב עם string (למשל institutionId שמגיע מ-JWT)
נשמר כ-string; שדה שנכתב עם ObjectId אמיתי (כמו `institution._id` בקוד פנימי)
נשמר כ-ObjectId. חוסר עקביות שקט. **תפסתי את זה** כי `GET /institutions/me`
החזיר `settings: null` על אף שהמסמך קיים ב-DB — כי `register()` יצר את
ה-settings עם `institution._id` (ObjectId אמיתי), אבל `getMe()`/`getSettings()`
שאלו עם `institutionId` string מה-JWT — type mismatch, אפס תוצאות.

**למה זה לא נתפס קודם:** רוב המודולים (Participant, Group וכו') כתבו **וגם**
קראו עם string בעקביות (שניהם מגיעים מ-JWT), אז זה "עבד במקרה". זה נשבר רק
כשמסלול אחד כתב ObjectId אמיתי ומסלול אחר קרא עם string — בדיוק המקרה של
Institution↔InstitutionSettings.

**התיקון:** בכל 10 הקבצים, `type: Types.ObjectId` → `type: SchemaTypes.ObjectId`
(עם `import { SchemaTypes } from 'mongoose'` — לא `Schema.Types` כי `Schema`
כבר מיובא מ-`@nestjs/mongoose` בכל קובץ ויוצר התנגשות שמות). `Types.ObjectId`
עדיין נשאר בשימוש כטיפוס TypeScript (`institutionId: Types.ObjectId | null`)
— זה תקין ולא קשור לבאג.

**אומת אחרי התיקון (מול Mongo אמיתי דרך Docker, DB נקי מאפס):**
- `register()` → `login()` → `GET /institutions/me` מחזיר `settings` תקין (לא null)
- `PUT /institutions/settings` עובד (קודם היה מחזיר 404)
- `institutionId` מאוחסן כ-BSON ObjectId אמיתי (נבדק ישירות ב-mongosh: `instanceof ObjectId === true`)
- שרשרת מלאה: Group + Participant + ParticipantGroup + סינון `?groupId=` (שאילתה חוצת-collections) — עובד נכון

**קבצים שתוקנו:** `field-definition.schema.ts`, `field-option.schema.ts`,
`group.schema.ts`, `institution-settings.schema.ts`, `participant-group.schema.ts`,
`participant.schema.ts`, `registration-request.schema.ts`, `staff-group.schema.ts`,
`staff.schema.ts`, `user.schema.ts`.

**עדכון (2026-08-10, אחר כך): הבדיקה הידנית הזו הפכה לטסטים אוטומטיים** —
ראו `test/integration/`. הרצתי ניסוי מכוון: **החזרתי את הבאג זמנית**
(`type: Types.ObjectId` בחזרה) והרצתי רק את `institution-settings.integration-spec.ts`
— שני מתוך שלושה טסטים נכשלו **בדיוק** באותם אופנים שנצפו ידנית
(`settings: null`, `PUT` מחזיר 404). זה מוכיח שהטסטים באמת תופסים את
הבאג הזה ולא רק "עוברים במקרה". אחרי זה שוחזר התיקון וכל הטסטים חזרו לירוק.

## 🚨 באג שני שנמצא ותוקן — aggregate() לא עובר cast אוטומטי (2026-08-13)

**נמצא בכתיבה הראשונה של טסט integration למיון דינמי** (`dynamic-field-sort-filter.integration-spec.ts`)
— לא בבדיקה ידנית הפעם, אלא ישירות מכתיבת הטסט האוטומטי. זו ההוכחה הכי
טובה לכך שהתשתית עובדת: תפסה באג לפני שהמשתמשים בכלל נתקלים בו.

**מה היה שבור:** `ParticipantsService.findSortedByDynamicField` (המיון
הדינמי לפי שדה מותאם אישית, סעיף 40) בונה `filter.institutionId` כ-**string**
(מגיע מ-JWT) ומעביר אותו ל-`.aggregate([{ $match: filter }, ...])`.
בניגוד ל-`.find()`/`.findOne()`, **`.aggregate()` לא עובר דרך שכבת ה-cast
האוטומטי של Mongoose** — הוא מועבר ישירות ל-MongoDB driver. string
לא תואם ObjectId מאוחסן → `$match` לא מוצא אף מסמך → **תוצאה ריקה
לגמרי** (לא רק סדר שגוי — 0 תוצאות).

**התיקון:** לפני בניית ה-pipeline, `filter.institutionId` מומר במפורש
ל-`new Types.ObjectId(...)` אם הוא string. תוקן ב-`findSortedByDynamicField`
בלבד (הפונקציה היחידה בכל הפרויקט שמשתמשת ב-`.aggregate()` — נבדק עם
grep גורף על `src/`).

**לקח כללי:** `.find()`/`.findOne()`/`.findOneAndUpdate()` וכו' עוברים
cast אוטומטי לפי סוג השדה בסכימה (string↔ObjectId). **`.aggregate()` לא** —
כל ObjectId שנכנס ל-`$match` (או כל שלב אחר) בתוך pipeline חייב להיות
מומר ידנית מראש. חשוב לזכור אם יתווספו עוד aggregation pipelines בעתיד.

## 🚨 באג שלישי שנמצא ותוקן — nested schema classes נופלים בשקט ל-Mixed (2026-08-13)

**נמצא תוך כדי כתיבת טסט integration ל-field-level permissions על RegistrationRequest**
(`registration-request-field-validation.integration-spec.ts`) — שוב לא בבדיקה
ידנית: ה-happy-path הכי בסיסי (הרשמה עצמית עם שדה רגיל, בלי permissions מפורש)
נכשל עם `403 FIELD_EDIT_FORBIDDEN`, על אף שברירת המחדל התיעודית (סעיף 21)
היא ש-Participant **כן** יכול לערוך שדות משלו כברירת מחדל.

**מה היה שבור:** ב-`field-definition.schema.ts`, המחלקות המקוננות
`RolePermission`/`FieldPermissions`/`DisplaySettings`/`SearchSettings` היו
מחלקות TS רגילות עם `@Prop()` על השדות שלהן, **אבל בלי `@Schema()` ובלי
`SchemaFactory.createForClass()`** — כלומר מעולם לא הפכו ל-Schema אמיתי.
`@Prop({ type: FieldPermissions })` (מעביר את ה-**מחלקה** עצמה, לא Schema)
גרם ל-Mongoose ליפול בשקט ל-`Mixed` (אומת ישירות:
`schema.path('permissions').instance === 'Mixed'`).

**איך זה התבטא בפועל:** תחת `Mixed`, אף אחת מברירות המחדל המקוננות
(`participant.edit: true`, `staff.edit: false`, וכו') **מעולם לא הוחלה**.
`FieldDefinitionsService.create()` תמיד שולח `permissions: dto.permissions ?? {}`
(אובייקט ריק מפורש, לא `undefined`) — וכש-`{}` מגיע ל-path מסוג `Mixed`
בלי schema אמיתי, **כל השדה `permissions` נעדר לגמרי מהמסמך שנשמר במסד**
(לא even `{}` — נבדק ישירות מול ה-collection). כל FieldDefinition שנוצר בלי
לספק `permissions` מפורש קיבל בפועל "אין הרשאת edit לאף אחד חוץ מ-ADMIN" —
ההפך הגמור מברירת המחדל התיעודית. זה לא נתפס קודם כי כל טסט/שימוש קודם
שנגע בזה או כתב כ-ADMIN (שעוקף את הבדיקה לגמרי, סעיף 21) או סיפק
`searchSettings`/`permissions` מלא במפורש (עובד תחת Mixed כי אתה פשוט
שומר מה שנתת — הבעיה היא רק בברירת המחדל).

**התיקון:** כל אחת מ-4 המחלקות המקוננות קיבלה `@Schema({ _id: false })` +
`SchemaFactory.createForClass()` משלה, וה-`@Prop({ type: ... })` בהורה
מפנה עכשיו ל-**Schema** האמיתי (`FieldPermissionsSchema` וכו'), לא למחלקה.

**כלל עומד חדש (נוסף גם ל-CLAUDE.md):** מחלקת TypeScript מקוננת שמשמשת
כ-`@Prop({ type: SomeClass })` **חייבת** להיות מעוטרת ב-`@Schema()` ועוברת
דרך `SchemaFactory.createForClass()`, וה-`type:` בהורה חייב להפנות ל-**Schema
שנוצר**, לא למחלקה עצמה — אחרת Mongoose נופל בשקט ל-`Mixed` בלי שגיאה,
בלי warning, ומאבד לגמרי את ברירות המחדל/ה-cast/ה-validation של אותו path.

**סריקה נוספת:** `grep` ממוקד על כל `src/**/*.schema.ts` אחרי התיקון מצא **מופע
נוסף** מאותו דפוס בדיוק — `RequestedData` ב-`registration-request.schema.ts`
(`@Prop({ type: RequestedData, required: true })`, שוב בלי `@Schema()`).
תוקן באותו אופן (`@Schema({ _id: false })` + `SchemaFactory.createForClass()`
+ הפניה ל-`RequestedDataSchema`). לא נמצאו מופעים נוספים (נבדק עם
`grep -rn "type:\s*[A-Z]\w+,?\s*$"` על כל קבצי ה-schema — כל שאר ההתאמות
הן `type: String`/`type: Date`/`type: SchemaTypes...` תקינים).

**אומת:** נבדק ישירות (`schema.path('permissions').instance`) לפני התיקון
(`'Mixed'`) ואחרי (`'Embedded'`/סכימה אמיתית); טסט regression חדש קורא
ישירות מה-DB ומוודא ש-`permissions.participant`/`permissions.staff` מכילים
את ערכי ברירת המחדל המלאים גם כש-Admin לא ציין permissions בכלל. כל 33
טסטי האינטגרציה (כולל כל הקיימים) עברו אחרי התיקון — ללא רגרסיה.

---

## החלטות פתוחות / שאלות לבעל המוצר

- **זיהוי מוסד ב-login (סעיף 66):** בקשת ה-login מכילה `username`+`password` בלבד, אבל `username` ייחודי רק *בתוך* מוסד. הפתרון הזמני ל-v1: מחפשים את כל המשתמשים הפעילים עם אותו username ומקבלים את זה שהסיסמה שלו תואמת (`AuthService.login`). אם בעל המוצר ירצה — לשקול הוספת מזהה מוסד ל-login או username גלובלי (אימייל). ליישום ב-`src/modules/auth/auth.service.ts`.
- רישום מוסד (`register`) מבצע יצירה סדרתית ללא טרנזקציה (MongoDB standalone לא תומך ב-transactions). יש rollback ידני אם יצירת האדמין/הגדרות נכשלת. אם עוברים ל-replica set — כדאי לעטוף ב-session/transaction.
- **"Staff (according to institution settings)" ליצירת Participant (סעיף 71):** אין כרגע דגל ב-`InstitutionSettings` שקובע האם STAFF רשאי ליצור Participant — כרגע כל STAFF מורשה (per CASL entity-level). אם בעל המוצר רוצה toggle — צריך להוסיף שדה להגדרות ולבדוק אותו ב-`ParticipantsController`/`Service`.
- **Group-scoping ל-STAFF (סעיף 19, 519, 833):** ממומש ב-`ParticipantsService` (לא כתנאי CASL native, אלא כלוגיקת שירות שמסננת לפי `StaffGroup`+`ParticipantGroup` כש-`staffGroupManagementEnabled=true`). CASL כרגע אחראי רק לרמת entity (can/cannot על הישות כולה), לא field-level — זה עדיין לא בנוי (חלק מ-Dynamic Schema Engine).
- **`institutionId` בגוף הבקשה ב-`POST /registration-requests` (סעיף 84, 13):** יוצא דופן מכוון לכלל "לעולם לא institutionId מה-body" (סעיף 91) — השולח אינו מאומת (אין JWT), אז אין מקור אחר. הבקשה יוצרת רק `RegistrationRequest` ב-Pending, לא דאטה עסקית. מתועד ב-DTO עצמו.
- **`participantUserMode = 'optional'` באישור בקשת הרשמה (סעיף 15):** האפיון לא קובע מי מחליט. החלטה: המנהל המאשר בוחר per-request דרך `createUser` (ברירת מחדל `false`) ב-body של ה-approve. ל-`'always'` תמיד נוצר User, ל-`'never'` אף פעם.
- **Username אוטומטי כשנוצר User באישור בקשת הרשמה:** אין username בבקשת ההרשמה המקורית (רק firstName/lastName/customFields) — נוצר אוטומטית מ-`firstName.lastName.<סיומת רנדומלית>`. אפשר לשקול לתת למנהל לספק username מותאם ב-body של approve בעתיד.
- **required=true עם רשומות קיימות חסרות ערך (סעיף 31):** אם יש רשומות חסרות, `PUT /field-definitions/:id` נכשל עם `REQUIRED_CHANGE_NEEDS_CONFIRMATION` ומספר הרשומות החסרות. Option A (השארה כמו שהיא) = לשלוח שוב עם `confirmRequiredChange:true`. Option B (מילוי ידני קודם) = לתקן את הרשומות דרך endpoints רגילים ואז לשלוח את אותו PUT בלי דגל — הבדיקה תעבור אוטומטית כשהמספר יגיע ל-0.
- **שינוי fieldType (סעיף 32):** נבדק בפועל מול **כל** הערכים הקיימים תחת אותו `internalKey` בכל הרשומות של המוסד/סוג הישות (Participant/Staff/Group). אם ולו רשומה אחת לא תואמת — כל הבקשה נדחית (`INCOMPATIBLE_FIELD_TYPE_CHANGE`), אין המרה חלקית. לביצועים בקנה מידה גדול ייתכן שיהיה צריך אופטימיזציה (אגרגציה עם projection) — כרגע טוען את כל המסמכים התואמים לזיכרון.
- **מחיקת FieldDefinition (סעיף 82.1):** מחיקת ה-FieldDefinition עצמה סינכרונית; ניקוי ה-`customFields` מהרשומות הקיימות (`$pull`) הוא "fire-and-forget" — לא ממתינים לו בתגובת ה-API, רק נרשם ללוג בסיום. אין עדיין תשתית job queue אמיתית (Bull/Redis) — זה ריצה ברקע של אותו תהליך Node, לא job עצמאי.
- **DynamicValidationPipe — reject ולא strip (סעיף 36):** האפיון מציע "Automatically strip or reject". בחרתי **reject** (שגיאה חוזרת ללקוח) על ניסיון לכתוב שדה שאין הרשאת edit אליו, במקום לזרוק את הערך בשקט — כדי שכשלים בהרשאות יהיו גלויים ולא יבלעו בלי הודעה. ממומש ב-`DynamicFieldsValidatorService`.
- **Field-level READ permissions (סעיף 21) — הושלם:** `DynamicFieldsValidatorService.getViewableKeys`/`filterByViewableKeys`. שדה עם `view:false` לתפקיד המבקש מוסתר לגמרי מ-GET (list/single/אחרי update) של Participant/Staff/Group. ADMIN רואה תמיד הכל (מחזיר `null` = "אין סינון"). entry עם מפתח (`k`) שאין לו FieldDefinition תואם מוסתר גם הוא מ-STAFF/PARTICIPANT כברירת מחדל בטוחה (לדוגמה שארית אחרי מחיקת שדה שהניקוי ברקע עוד לא הגיע אליה). **עדכון 2026-08-13:** עד לתיקון הבאג הקריטי השלישי (Mixed fallback, ראו למעלה), ברירות המחדל של `permissions` בפועל מעולם לא הוחלו על שדות שנוצרו בלי permissions מפורש — נבדק/תוקן/מכוסה עכשיו ב-regression test.
- **Field-level permissions על RegistrationRequest (סעיפים 13, 21, 36-37) — הושלם 2026-08-13:** `RegistrationRequestsService.submit()` (בקשה ציבורית, ללא JWT) עכשיו מריץ `DynamicFieldsValidatorService.validate()` עם `role: Role.Participant` — כי הנתונים הופכים ל-Participant באישור, אז ההרשאה ההגיונית היא `permissions.participant.edit`. קודם לכן שום אימות דינמי (unknown-key/type/required/write-permission) לא רץ בכלל ב-submit(); כשל היחיד היה מאוחר ומבלבל, ב-approve() (עם role=Admin, שכמעט תמיד עובר). **Edge case מתועד (לא נפתר, ידוע):** אם Admin מגדיר שדה כ-`required:true` וגם `permissions.participant.edit:false` (למשל שדה פנימי חובה שרק Admin ממלא), הרשמה עצמית תיכשל תמיד עם "missing required field" — אין דרך למשתמש הציבורי למלא אותו. לא טופל — נדרשת החלטת מוצר אם/איך לאפשר קומבינציה כזו.
- **תיקון אגבי: `_id:false` על איברי customFields:** גילינו שהמערכים `customFields:[{k,v}]` ב-Participant/Staff/Group/RegistrationRequest קיבלו `_id` אוטומטי מ-Mongoose לכל איבר (לא חלק מהמבנה הקנוני בסעיף 35). תוקן בכל הסכימות.
- **ביצועי סינון READ:** `getViewableKeys` נקרא **פעם אחת** לכל בקשת GET (גם ברשימה שלמה, לא לכל רשומה) כדי למנוע N+1 שאילתות.
- **ADMIN עוקף את כל בדיקות ה-DynamicValidationPipe פרט למבנה/טיפוס:** ADMIN עדיין עובר בדיקת "unknown key"/"invalid type"/"missing required" (בדיקות שלמות דאטה), אבל לא בדיקת הרשאת edit (יש לו תמיד edit מלא, per סעיף 21 editorial note). קריאות פנימיות (כמו `RegistrationRequestsService.approve`) עוברות עם role=ADMIN כברירת מחדל.
- **Dynamic filter/sort — כעת ב-Participants+Staff+Groups (סעיפים 38-40, עודכן 2026-08-13):** `filters` הוא JSON string `{internalKey:value}` שהופך ל-`$all`/`$elemMatch` (AND בין כמה שדות), נאכף רק אם `searchSettings.filterable=true`. `sortBy`/`sortDir` — אם `sortBy` הוא שדה מערכת ממוינים רגיל; אם זה internalKey עם `searchSettings.sortable=true` — עובר ל-aggregation pipeline (`$addFields`+`$let`+`$filter` לחלץ את הערך מתוך מערך ה-customFields, `$sort` לפיו). הלוגיקה עברה ל-`DynamicQueryService` משותף (ראו למעלה) ומכוסה ב-integration tests אמיתיים מול MongoDB לכל שלוש הישויות.
- **npm audit fix (2026-07-27):** תוקנה חולשת אבטחה "high severity" בחבילה עקיפה (`brace-expansion`, תלות של jest/typescript-eslint) שהתגלתה בבדיקת clone נקי. תלות פיתוח בלבד, לא בקוד הייצור. `npm audit fix` פתר בלי לשבור כלום (build/lint/test אומתו אחרי).
- **mustChangePassword — עלות ביצועים מקובלת (סעיף 70.1):** `MustChangePasswordGuard` קורא ל-DB בכל בקשה מוגנת (לא נשען על השדה ב-JWT, כי סעיף 67 אוסר "frequently changing settings" בטוקן — וזה בדיוק שדה כזה: משתמש שממש שינה סיסמה חייב "להשתחרר" מיידית, לא אחרי שה-cache יפוג). Trade-off מתועד: תקינות מיידית > ביצועים.
- **נעילת חשבון per-username (סעיף 90.1):** נוספו שדות `failedLoginAttempts`/`lockedUntil` ל-`User`. לאחר 5 ניסיונות כושלים על אותו חשבון — ננעל ל-15 דקות, ללא קשר לכתובת ה-IP. המספרים (5 ניסיונות, 15 דקות) הם ערכים שנבחרו — האפיון לא מציין מספרים מדויקים. חשבון נעול מדולג ישירות (לא מנסים bcrypt.compare בכלל) — לא מגדילים את מונה הכשלונות בזמן שהחשבון כבר נעול.
- **Rate limiting IP-based — אחסון בזיכרון (`@nestjs/throttler` ברירת מחדל):** מתאים לאינסטנס שרת בודד. אם יהיה scale-out (כמה אינסטנסים מאחורי load balancer), יהיה צריך storage משותף (Redis) כדי שהמגבלה תיאכף נכון על פני כל האינסטנסים.
- **Integration tests עם `mongodb-memory-server` ולא Docker (סעיף 102):** נבחר במכוון — מריץ MongoDB **אמיתי** (לא mock) בזיכרון, ללא תלות ב-Docker daemon בזמן ריצת הטסטים. עובד זהה מקומית וב-CI, בלי הבעיות שנתקלנו בהן עם Docker Desktop. `test/integration/setup-mongo.ts` מפעיל/מכבה, `test/integration/bootstrap-app.ts` בונה אפליקציית Nest מלאה (אותו ValidationPipe כמו `main.ts`), `test/integration/http-helpers.ts` נותן טיפוס בטוח ל-`.body.data` של supertest. הרצה: `npm run test:integration`. **מכסה כרגע (38 טסטים, 7 קבצים):** רגרסיית הבאג הקריטי (Institution↔Settings), שרשרת Group+Participant+ParticipantGroup, security (`security.integration-spec.ts`, סעיף 102.3), dynamic sort/filter ב-Participants (`dynamic-field-sort-filter.integration-spec.ts`, סעיפים 38-40 — תפס באג אמיתי שני, ראו למעלה) וב-Staff/Groups (`dynamic-field-sort-filter-staff-groups.integration-spec.ts`), RegistrationRequest field validation (`registration-request-field-validation.integration-spec.ts` — תפס באג אמיתי שלישי, ראו למעלה), ו-free-text search ב-Staff/Groups (`search-staff-groups.integration-spec.ts`, נוסף 2026-08-15). **אומת ששבירת tenant isolation גורמת לכישלון מדויק** — לפני שהוחזר.
- **Logging — מה כן ומה לא נרשם (סעיף 96):** `LoggingInterceptor` רושם רק בקשות שהצליחו (method+path+duration+userId/role/institutionId אם קיים) — **לא** רושם גוף בקשה/תגובה (עלול לכלול סיסמאות/customFields רגישים). שגיאות 4xx **לא** נרשמות ע"י ה-interceptor ולא ע"י `AllExceptionsFilter` (שרושם רק 500+) — חוץ מכניסה מפורשת אחת: ניסיונות login כושלים (`AuthService`, WARN) כי סעיף 96 דורש את זה בשם מפורש. `Logger('HTTP')` נפרד מ-Nest's internal loggers כדי לזהות בקלות בלוגים אילו שורות שלנו.
- **`DynamicQueryService` משותף ל-Participants/Staff/Groups (סעיפים 38-40, 2026-08-13):** הלוגיקה של filter/sort דינמי (כולל ה-aggregation pipeline וכלל ה-cast הידני ל-ObjectId, ראו הבאג הקריטי השני למעלה) חולצה מ-`ParticipantsService` ל-`dynamic-fields/dynamic-query.service.ts` גנרי (`findAll<TDoc>(model, institutionId, entityType, baseFilter, options)`). ParticipantsService רופקטר להשתמש בו (ללא שינוי התנהגות — כל 6 הטסטים הישנים עדיין עוברים ללא שינוי), ו-Staff/Groups קיבלו את התכונה בפעם הראשונה עם `QueryStaffDto`/`QueryGroupsDto` חדשים (filters/sortBy/sortDir — ללא `search`/`groupId` שספציפיים ל-Participants). כל אחד מגדיר set משלו של system-sort-fields (Participants: firstName/lastName/createdAt; Staff: זהה; Groups: name/createdAt).

### סקירת אפיון מלאה (2026-08-14) — 3 פערי תיעוד קטנים שנמצאו

עברתי שוב על **כל 105 הסעיפים** של האפיון מול הקוד בפועל (לא רק מול PROGRESS.md) כדי לוודא שאין פער גדול שפספסנו. המסקנה: ~97% מומש ומאומת. נמצאו 3 מקומות שבהם התקבלה החלטת מימוש סבירה **בלי לתעד אותה במפורש** כ"החלטה פתוחה" — בניגוד לנוהג שהוקפד עליו בכל שאר הפרויקט. הוחלט (לפי בעל הפרויקט) **לתעד בלבד, לא לשנות קוד**:

- **אין endpoint ייעודי `GET /participants/search` (סעיף 85):** האפיון מציג את זה כדוגמה לנתיב חיפוש נפרד. בפועל `search` הוא query param רגיל על `GET /participants` (`?search=David`) — מכסה את אותה דרישה פונקציונלית (חיפוש בשדות מערכת + דינמיים + סינון הרשאות, עדיין `PermissionFiltering` דרך `getViewableKeys`), רק לא כ-route נפרד. לא נראה כמו פער אמיתי — סטייה טקסטואלית מהאפיון, לא פונקציונלית.
- **אין `TenantInterceptor` גלובלי (סעיף 93):** האפיון מתאר interceptor אוטומטי שמזריק `{institutionId: user.institutionId}` לכל הקשר שאילתה. במימוש בפועל כל Service (Participants/Staff/Groups/וכו') מוסיף `institutionId` **ידנית** לפילטר שלו בתחילת כל מתודה — עובד נכון (מכוסה ב-4 טסטי tenant-isolation ב-`security.integration-spec.ts`), אבל זו הגנה "per-module ידנית" ולא "global אוטומטית" כפי שהאפיון מתאר ארכיטקטונית. Trade-off: פחות DRY, אבל יותר גלוי/קריא בקוד כל Service (כל בדיקת סינון institutionId נראית מקומית, לא "קורית איפשהו למעלה"). לא שונה בפועל.
- **אין refresh token (סעיף 68, "if required" — מנוסח כאופציונלי) ואין הודעת email באישור מוסד (סעיף 69.1, שלב 3):** email תלוי ב-Notifications שנדחה מפורש לגרסה עתידית (סעיף 103.4) — עקבי. Refresh token לא נדרש באופן מוחלט לפי הניסוח ("if required") ולא יושם ב-v1 — אין refresh mechanism, רק access token עם expiry (`JWT_EXPIRES_IN`).

## מה הבא בתור (Next up)

**סטטוס כללי (2026-08-15): ~98% מהאפיון מומש ומאומת.** מה שנשאר הוא ליטוש/החלטות מוצר, לא חוסרים פונקציונליים ידועים:

1. `search` (חיפוש טקסט חופשי) הושלם ל-Staff/Groups (2026-08-15) — ראו טבלת Dynamic Schema Engine למעלה. זה היה הפריט האחרון שהתגלה כחסר בפועל (לא רק לא-מתועד) בסקירת האפיון המלאה מ-2026-08-14.
2. שקול לטפל ב-edge case המתועד: `required:true` + `permissions.participant.edit:false` על אותו שדה חוסם הרשמה עצמית לצמיתות (ראו החלטה פתוחה למעלה) — צריך החלטת מוצר, לא ניתן להחליט מהקוד לבד.
3. שלושת הסטיות התיעודיות מ-2026-08-14 (`/participants/search` נפרד, `TenantInterceptor` גלובלי, refresh token) — הוחלט להשאיר כמו שהן, מתועדות בלבד.
3. סריקת `@Prop({ type: [A-Z]` בוצעה (2026-08-13, מצאה ותיקנה את `RequestedData`) — שווה לחזור עליה מדי פעם אחרי הוספת schemas חדשים, אבל אין כרגע חשד למופע נוסף.

## יומן דחיפות (Session Log)

| תאריך | מפתחת/סשן | מה נעשה | סטטוס בסיום |
|-------|-----------|---------|-------------|
| 2026-07-24 | Claude (Miryam) | סקיל שיטת עבודה + PROGRESS + תשתית common + Auth/Users/Institution בסיסי | ✅ נדחף |
| 2026-07-24 | Claude (Miryam) | CASL Ability Factory+Guard, Groups, Participants (+group/self scoping), Staff, ParticipantGroup, StaffGroup | ✅ נדחף |
| 2026-07-26 | Claude (Miryam) | RegistrationRequest — submit (public) + list/approve/reject (Admin), יצירת Participant+User אופציונלי באישור | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | FieldDefinition + FieldOption CRUD מלא — internalKey אוטומטי, בדיקות בטיחות ל-required/fieldType change מול דאטה קיים, מחיקה עם ניקוי customFields ברקע | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | DynamicValidationPipe (`DynamicFieldsValidatorService`) — נאכף על create/update של Participant/Staff/Group: unknown-key, type/required, write-permission (reject) | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | Field-level READ permissions — סינון customFields ב-GET לפי `view` permission; תיקון `_id:false` על customFields entries | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | Dynamic search/filter/sort ל-Participants — `filters` JSON + `sortBy`/`sortDir` עם aggregation pipeline לשדות דינמיים (לא נבדק עדיין מול DB אמיתי) | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | תיעוד: תיקיית `docs/` עם 11 קבצים — הסבר כללי, מבנה פרויקט, כל מודול לעומק, ומילון מונחים (כולל Docker) | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | תיעוד מורחב: 4 קבצים נוספים (12-15) — הסברי קוד שורה-שורה ל-common/auth/users, Docker מורחב, enum-vs-union-type | ✅ נדחף |
| 2026-07-27 | Claude (Miryam) | אימות מלא מ-clone נקי (npm install+build+lint+test+e2e) בתיקייה זמנית — סימולציית "מפתחת אחרת"; תוקנה חולשת אבטחה שהתגלתה (brace-expansion, dev dep) | ✅ נדחף |
| 2026-08-03 | Claude (Miryam) | mustChangePassword אכיפה בפועל (`MustChangePasswordGuard` גלובלי) + Rate limiting (`@nestjs/throttler`: IP-based על login/registration-requests, נעילת חשבון per-username על login) | ✅ נדחף |
| 2026-08-03 | Claude (Miryam) | תוקנה חולשת אבטחה נוספת שהתגלתה ב-clone נקי (`fast-uri`, הובאה ע"י `@nestjs/throttler`) — `npm audit` מציג 0 חולשות כעת. אומת שוב בזרימת clone-נקי מלאה (install+build+lint+test+e2e) | ✅ נדחף |
| 2026-08-10 | Claude (Miryam) | Docker (Dockerfile+docker-compose+dockerignore), הורץ בפועל עם `docker compose up` מול MongoDB אמיתי. **תפס באג קריטי** ב-10 קבצי schema (`type:Types.ObjectId` → `Mixed` type, לא `ObjectId`) — תוקן ל-`SchemaTypes.ObjectId`, אומת מחדש מקצה-לקצה (register/login/CRUD/cross-collection filter) | ✅ נדחף |
| 2026-08-10 | Claude (Miryam) | Integration tests אוטומטיים (`test/integration/`, `mongodb-memory-server`) — 5 טסטים מול Mongo אמיתי; אומת שהם תופסים רגרסיות ע"י החזרת הבאג הקריטי זמנית ובדיקה שהטסטים נכשלים כצפוי | ✅ נדחף |
| 2026-08-10 | Claude (Miryam) | Security integration tests (סעיף 102.3) — `security.integration-spec.ts`: tenant isolation (2 מוסדות), unauthenticated access, RBAC (STAFF vs Admin), mustChangePassword enforcement. 9 טסטים; אומת ששבירת tenant isolation גורמת לכישלון מדויק לפני שחזור | ✅ נדחף |
| 2026-08-13 | Claude (Miryam) | Integration tests למיון/סינון דינמי (`dynamic-field-sort-filter.integration-spec.ts`, סעיפים 38-40) — **תפס באג אמיתי שני** בכתיבתו הראשונה: `.aggregate()` לא עובר cast אוטומטי כמו `.find()`, `institutionId` string לא תאם ObjectId מאוחסן → 0 תוצאות. תוקן ב-`findSortedByDynamicField` | ✅ נדחף |
| 2026-08-13 | Claude (Miryam) | Logging מובנה (סעיף 96) — `LoggingInterceptor` גלובלי + לוג מפורש login מוצלח/כושל ב-`AuthService`. אומת בפועל מול Docker אמיתי (`docker compose logs`) | ✅ נדחף |
| 2026-08-13 | Claude (Miryam) | Dynamic search/filter/sort הורחב ל-Staff+Groups (סעיפים 38-40) — לוגיקה חולצה ל-`DynamicQueryService` משותף (`dynamic-fields/dynamic-query.service.ts`); ParticipantsService רופקטר לשימוש בו (ללא שינוי התנהגות); 8 טסטי אינטגרציה חדשים מול MongoDB אמיתי | ✅ נדחף |
| 2026-08-13 | Claude (Miryam) | Field-level permissions על RegistrationRequest (סעיפים 13, 21, 36-37) — `submit()` מריץ עכשיו `DynamicFieldsValidatorService.validate()` עם role=Participant. **תפס באג קריטי שלישי** (Mixed fallback על מחלקות מקוננות בלי `@Schema()`/`SchemaFactory.createForClass()` ב-`field-definition.schema.ts` — permissions/displaySettings/searchSettings מעולם לא קיבלו ברירות מחדל אמיתיות). Audit Log (97) אושר סופית כ-out-of-scope לפי האפיון עצמו. תוקן + 5 טסטי אינטגרציה חדשים; כל 33 טסטי האינטגרציה עברו | ✅ נדחף |
| 2026-08-14 | Claude (Miryam) | סקירת אפיון מלאה (כל 105 הסעיפים מול הקוד בפועל, לא רק מול PROGRESS.md) — מסקנה: ~97% מומש. נמצאו ותועדו (לפי החלטת בעל הפרויקט — תיעוד בלבד, ללא שינוי קוד) 3 סטיות קטנות לא-פונקציונליות: אין `GET /participants/search` נפרד (סעיף 85, יש query param שקול), אין `TenantInterceptor` גלובלי (סעיף 93, יש סינון institutionId ידני לכל Service), אין refresh token/email notification (סעיפים 68, 69.1 — עקבי עם Notifications הנדחה, 103.4). אין שינוי קוד בסשן זה | ✅ נדחף (תיעוד בלבד) |
| 2026-08-15 | Claude (Miryam) | `search` (חיפוש טקסט חופשי) הורחב ל-Staff/Groups (סעיפים 72, 85) — הפריט הפעיל היחיד שנותר מסקירת האפיון. `escapeRegex` חולץ ל-`common/utils/regex.util.ts` משותף (הוסר שכפול פרטי מ-`ParticipantsService`). 5 טסטי אינטגרציה חדשים; כל 38 טסטי האינטגרציה עברו | ✅ נדחף |
| 2026-08-16 | Claude (Miryam) | דוח מסכם מפורט (`docs/16-full-project-report.md` + `.docx`) — סיכום כרונולוגי מלא של כל תהליך הבנייה עד כה, כולל ארכיטקטורה, מנוע השדות הדינמי, שלושת הבאגים הקריטיים בפירוט, אסטרטגיית בדיקות וציר זמן. נכתב עבור מפתחת שלא הייתה מעורבת בפרויקט. אין שינוי קוד; רק תיעוד | ✅ נדחף (תיעוד בלבד) |
| 2026-08-31 | Claude (Miryam) | `app.enableCors()` נוסף ל-`main.ts` (חסר לגמרי קודם) — התגלה תוך כדי בניית פרונטנד חדש (`talmyeda-frontend`, ריפו נפרד): כל קריאת API מהדפדפן נכשלה עם "Network Error" כי לא היה CORS בכלל. Origin allowlist מוגדר דרך `CORS_ORIGIN` (ברירת מחדל: פורטי Vite dev 5173/5174), `credentials:true`. אומת ידנית מול השרת הרץ (`curl -X OPTIONS` עם `Origin` header → `Access-Control-Allow-Origin` תקין) ומול login אמיתי מהפרונטנד. `npm run build` עבר; **`npm run lint`/`npm test` לא הורצו בסשן זה** — הסביבה הייתה תחת עומס זיכרון קיצוני (רק ~2.5GB פנויים מתוך 16GB, כנראה משני שרתי dev שרצים ברקע), ו-ESLint קרס עם JS heap OOM בכל ניסיון. שינוי קטן (2 שורות), סיכון נמוך, אך **יש להריץ lint+test בסשן הבא לפני שנחשב מאומת במלואו** | ⏸️ חלקי (build בלבד; lint/test ממתינים) |
| 2026-08-31 | Claude (Miryam) | `lint`+`test`+`test:integration` מהסשן הקודם הורצו בהצלחה (הזיכרון התפנה) — 4+38 טסטים עברו, CORS מאומת סופית. בנוסף נוסף `GET /users/me` (`users.controller.ts`, `users.service.ts`) — פער אמיתי שהתגלה תוך כדי בניית מסך "הפרופיל שלי" ל-PARTICIPANT בפרונטנד: JWT לא מכיל `participantId`/`staffId` (בכוונה, סעיף 67), ולא היה שום endpoint שמאפשר למשתמש מחובר לגלות את ה-ID של הרשומה העצמית שלו כדי לקרוא ל-`GET /participants/:id` הקיים (שכבר תומך ב-self-scoping ל-PARTICIPANT). תוספת נטו, לא נוגעת בהתנהגות קיימת. `build+lint+test+test:integration` כולם עברו (49 טסטים) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | **באג רביעי שנתפס** תוך כדי בניית מסך "ניהול מוסדות" (SUPER_ADMIN) בפרונטנד: `GET /platform/institutions?status=Pending` דחה בשקט כל בקשה עם פילטר status — `platform.controller.ts` השתמש בשני `@Query()` נפרדים (`@Query('status')` חופשי + `@Query() pagination: PaginationQueryDto` שלא מכיר `status`), וה-`ValidationPipe` הגלובלי עם `forbidNonWhitelisted:true` דחה כל בקשה כזו עם "property status should not exist" — כלומר הפילטר שמתועד בעצם ה-JSDoc של ה-endpoint מעולם לא עבד בפועל. תוקן ע"י `QueryInstitutionsDto` משולב (אותו תבנית כמו `QueryRegistrationRequestsDto`). גם נוסף מסך פרונטנד מלא לניהול מוסדות (אישור/השעיה/הפעלה-מחדש/דחייה) שלא היה קיים בכלל קודם — פעולות אלה עבדו רק דרך curl/Postman. אומת מקצה-לקצה מול השרת האמיתי; `build+lint+test+test:integration` עברו (42 טסטים) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | הרשמה עצמית הורחבה מ-Participant-בלבד גם ל-Staff (מורים/צוות), לפי בקשה מפורשת: `RegistrationRequest` קיבל `entityType` (Participant\|Staff, ברירת מחדל Participant — תאימות לאחור מלאה לבקשות ישנות), `submit()`/`approve()` מסתעפים לפיו (`approveParticipant`/`approveStaff` חדשים); Staff לא מקבל יצירת User אוטומטית כמו `participantUserMode:Always` — רק אם ה-Admin מסמן `createUser:true` במפורש בעת האישור (אין הגדרת מוסד מקבילה ל-staff עדיין). בנוסף: endpoint ציבורי חדש `GET /registration-requests/fields?institutionId=&entityType=` — פותר פער אמיתי שנשאלה עליו השאלה "איפה התלמיד ממלא את הפרטים לפי מה שהמנהל הגדיר": קודם לא הייתה שום דרך למשתמש לא-מזוהה לדעת אילו שדות מותאמים אישית קיימים (`/field-definitions`+`/field-options` שניהם Admin-only), אז טופס ההרשמה יכול היה לאסוף רק שם פרטי/משפחה. ה-endpoint החדש מחזיר רק שדות שהתפקיד הרלוונטי (participant/staff) רשאי לערוך על עצמו (משתמש באותה בדיקת הרשאה שכבר קיימת ב-`DynamicFieldsValidatorService`, מורחבת כאן ל-Staff על אותו עיקרון — `permissions.staff` מתאר self-edit על שדה מסוג Staff, בדיוק כמו ש-`permissions.participant` כבר מתאר self-edit על שדה מסוג Participant), כולל אפשרויות Select/MultiSelect משוקעות (כדי לא לדרוש קריאה שנייה מאומתת). אומת מקצה-לקצה מול השרת האמיתי: נוצר שדה Staff, ניתנה הרשאת self-edit, נשלחה בקשת הרשמה עם ערך שדה מותאם, אושרה עם יצירת משתמש, המשתמש החדש התחבר ו-`/users/me` פתר את ה-staffId המקושר. `build+lint+test+test:integration` עברו (42 טסטים, ללא רגרסיות) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | תוקן פער "איך תלמיד מאושר מתחבר בפועל" — `createLoginFor()` (ב-`registration-requests.service.ts`) יצר username פנימית אבל החזיר רק tempPassword, זורק את ה-username בדיוק ברגע שה-Admin הכי צריך אותו (tempPassword בלי username תואם הוא חסר תועלת). עכשיו `approve()` מחזיר גם `username` וגם `tempPassword`. `build+lint+test+test:integration` עברו (42 טסטים) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | שלוש בקשות מוצר בו-זמנית: (1) username=שם המשתמש, סיסמה זמנית=שם פרטי+משפחה מחוברים — `generateUsername`/`createLoginFor` נכתבו מחדש; **תפס גם באג צדדי**: הסכימה הישנה עשתה lowercase+הסרת כל תו שאינו a-z0-9. כך שכל נרשם בעברית קיבל בשקט "participant.xxxx" בלי זכר לשם האמיתי — לא נתפס קודם כי כל שמות הבדיקה בסשן הזה היו אנגלית; אומת בפועל: "דני כהן" → username "דני כהן", סיסמה "דניכהן". (2) עריכה עצמית אמיתית של שדות מותאמים — `FieldDefinitionsService.findSelfEditableFields` (משותף עם ה-endpoint הציבורי מהסשן הקודם) + `GET /users/me/fields` חדש (authenticated, entityType נגזר מה-role בשרת, לא מהלקוח). (3) **פער גדול נתפס**: ל-STAFF לא הייתה בכלל גישה עצמית לרשומת ה-Staff שלו (GET/PUT /staff/:id תמיד Admin-only, CASL לא הגדיר שום הרשאת 'Staff' ל-Staff role) — א-סימטרי לגמרי מול Participant. נוסף אותו דפוס self-scoping בדיוק כמו ב-ParticipantsService (`findOneRaw`+`assertAccessible`+`resolveOwnStaffId`) ל-StaffService, הראוטים הורחבו ל-`@Roles(Admin, Staff)`, ותוספה הרשאת CASL תואמת לתיעוד. אומת מקצה-לקצה: הרשמה עברית→אישור→כניסה→שינוי סיסמה כפוי→`/users/me/fields`→עדכון שדה מותאם עצמי, לשני התפקידים; Staff שמנסה לגשת לרשומה אחרת מקבל STAFF_NOT_FOUND. `build+lint+test+test:integration` עברו (42 טסטים, ללא רגרסיות) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | **מודול חדש: הודעות** (`src/modules/messages/`) — "שמשתמש יוכל לשלוח הודעות למנהל", לא מכוסה באפיון (Notifications נדחה במפורש לגרסה עתידית, ראו רישום 2026-08-16 למעלה). Scope מכוון: תיבת דואר חד-כיוונית פשוטה, בלי threading/replies — הפתרון הפשוט ביותר שעונה על הבקשה, לא מערכת צ'אט מלאה. `POST /messages` (Participant/Staff, institutionId מה-JWT, fromUsername נלקח מרשומת ה-User בזמן השליחה), `GET /messages` (Admin, פאג'ינציה + פילטר unreadOnly), `GET /messages/mine` (הודעות שהמשתמש עצמו שלח), `GET /messages/unread-count`, `POST /messages/:id/read`. אומת מקצה-לקצה מול השרת האמיתי (שליחה כ"דני כהן"→הופעה בתיבת הדואר של המנהל עם שם אמיתי, לא ID). `build+lint+test+test:integration` עברו (42 טסטים) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | **פער נתפס**: "איך משייכים משתמשים לקבוצה?" — התברר ש-`ParticipantGroupsService.findForGroup()` וכמוה עבור staff-groups (נוספה) היו כתובות אבל **מעולם לא נחשפו דרך שום route** — אי אפשר היה לרשימת את חברי הקבוצה הנוכחיים בכלל, לא לצד participant ולא staff, ולכן גם לא ניתן היה לבנות עליהן שום מסך ניהול חברים. נוסף: `GET /participant-groups?groupId=` (רק חברויות פעילות — `active:true`), `GET /staff-groups?groupId=` (staff-groups אין להן מושג "פעיל", תואם למחיקה פיזית קיימת), וגם `groupId` כפילטר על `GET /staff` (היה קיים כבר ל-Participants, חסר ל-Staff — נוסף באותו דפוס בדיוק, `staffGroupModel` הוזרק ל-`StaffService`). אומת מקצה-לקצה: קבוצה נוצרה, תלמיד וגם איש צוות שויכו, שני ה-endpoints ושני פילטרי ה-groupId מחזירים נתונים נכונים. `build+lint+test+test:integration` עברו (42 טסטים, ללא רגרסיות) | ✅ נדחף |
| 2026-09-01 | Claude (Miryam) | הרשמה כפולה — "איך אני מבטיחה שלא יהיו רשומים כפולים": v1 הוגדר במפורש (סעיף 13.1) כ"אין זיהוי אוטומטי, מושאר לבדיקה ידנית של המנהל". נוספה בדיקה בזמן `submit()`: (1) אם כבר קיימת רשומת Participant/Staff מאושרת עם אותו שם באותו מוסד → נדחה עם `DUPLICATE_NAME` (המקרה הסביר ביותר: מישהו ששכח סיסמה מנסה שוב, לא אדם שני עם אותו שם). (2) אם כבר קיימת בקשה Pending עם אותו שם/entityType → נדחה עם `DUPLICATE_PENDING_REQUEST` (שליחה כפולה בטעות). התאמה מדויקת (case-insensitive) ולא מטושטשת — שני אנשים שונים עם שם זהה עדיין יעברו ויגיעו לבדיקה ידנית של מנהל, בדיוק כמו קודם. `ParticipantsService`/`StaffService.existsByName()` חדשים, משותפים. אומת מקצה-לקצה: שליחה כפולה של אותה בקשה ממתינה נדחתה; רישום מחדש בשם "דני כהן" (כבר מאושר מסשן קודם) נדחה. `build+lint+test+test:integration` עברו (42 טסטים, ללא רגרסיות) | ✅ נדחף |
