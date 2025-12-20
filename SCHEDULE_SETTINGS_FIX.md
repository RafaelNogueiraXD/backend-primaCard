# Schedule Settings Fix - Route Order & Professional Record Auto-Creation

## Problem

When accessing the Schedule Settings page, users with `PROFESSIONAL` role were getting a **500 Internal Server Error** with the message:

```
GET http://localhost:3000/api/v1/professionals/schedule-settings 500
API Error: Error: Professional not found
```

The error stack trace showed:
```
Error: Professional not found
    at ProfessionalService.getById (/backend-primaCard/src/modules/professionals/professional.service.ts:113:13)
    at async ProfessionalController.getById (/backend-primaCard/src/modules/professionals/professional.controller.ts:32:28)
```

## Root Causes

There were **TWO** issues causing this error:

### Issue 1: Express Route Order Problem ⚠️

The route `GET /api/v1/professionals/schedule-settings` was being matched by the **wrong handler** due to incorrect route ordering.

**Before (WRONG order):**
```typescript
router.get('/', ...);                              // Line 37
router.get('/:professionalId', ...);               // Line 55 - Catches EVERYTHING!
router.get('/:professionalId/availability', ...);  // Line 79
router.get('/:professionalId/procedures', ...);    // Line 97
router.get('/:professionalId/reviews', ...);       // Line 127
router.get('/statistics', ...);                    // Line 178 - Never reached!
router.get('/schedule-settings', ...);             // Line 192 - Never reached!
```

When requesting `/professionals/schedule-settings`:
- Express matches the first route that fits the pattern
- `/:professionalId` matches **any string**, including "schedule-settings"
- So it calls `getById('schedule-settings')` instead of `getScheduleSettings()`
- `getById` tries to find a professional with ID "schedule-settings"
- This throws "Professional not found"

**Express Rule:** Specific routes MUST come before dynamic parameter routes!

### Issue 2: Missing Professional Table Record

When a user is created with `role: PROFESSIONAL`, the `User` table record is created, but the `Professional` table record (which stores professional-specific data) was not automatically created.

## Database Structure

```prisma
model User {
  id       String   @id @default(uuid())
  role     UserRole // Can be PROFESSIONAL, PATIENT, ADMIN
  // ... other fields
}

model Professional {
  id                 String  @id @default(uuid())
  userId             String  @unique
  registrationNumber String  @unique  // CRO, CRM, etc
  specialty          String
  scheduleSettings   Json?   // Working hours, breaks, etc
  // ... other fields
}
```

The relationship is: `User` (1) -> (0..1) `Professional`

## Solution

### Fix 1: Correct Route Order ✅

Moved specific routes **BEFORE** the dynamic `:professionalId` route:

**After (CORRECT order):**
```typescript
router.get('/', ...);                              // Line 37
router.get('/statistics', ...);                    // Line 55 - Specific route first!
router.get('/schedule-settings', ...);             // Line 75 - Specific route first!
router.get('/:professionalId', ...);               // Line 95 - Dynamic route last!
router.get('/:professionalId/availability', ...);  // Line 113
router.get('/:professionalId/procedures', ...);    // Line 131
router.get('/:professionalId/reviews', ...);       // Line 161
```

Now when requesting `/professionals/schedule-settings`:
1. Express checks routes in order
2. Finds exact match at line 75
3. Calls correct handler: `getScheduleSettings()`
4. ✅ Works correctly!

### Fix 2: Auto-Create Professional Record ✅

Modified `getScheduleSettings` method to **automatically create** a `Professional` record if it doesn't exist:

### Before (Lines 577-620)
```typescript
async getScheduleSettings(userId: string): Promise<any> {
  // ... validation code ...
  
  // Try to get professional record
  const professional = await prisma.professional.findUnique({
    where: { userId },
    select: { scheduleSettings: true },
  });

  // ❌ Just returned defaults if no record found
  if (!professional || !professional.scheduleSettings) {
    return defaultSettings;
  }

  return professional.scheduleSettings;
}
```

### After (Lines 577-632)
```typescript
async getScheduleSettings(userId: string): Promise<any> {
  // ... validation code ...
  
  // Try to get professional record
  let professional = await prisma.professional.findUnique({
    where: { userId },
    select: { scheduleSettings: true },
  });

  // ✅ Create professional record if it doesn't exist
  if (!professional) {
    professional = await prisma.professional.create({
      data: {
        userId: user.id,
        registrationNumber: `TEMP-${userId.substring(0, 8)}-${Date.now()}`,
        specialty: 'Não informado',
        scheduleSettings: defaultSettings,
      },
      select: { scheduleSettings: true },
    });
  }

  // If no settings, return defaults
  if (!professional.scheduleSettings) {
    return defaultSettings;
  }

  return professional.scheduleSettings;
}
```

## Key Changes

1. **Auto-creation**: When a professional record doesn't exist, it's automatically created with:
   - `registrationNumber`: `TEMP-{userId-prefix}-{timestamp}` (ensures uniqueness)
   - `specialty`: "Não informado" (placeholder)
   - `scheduleSettings`: Default weekly schedule with working hours

2. **Unique Registration Number**: Format `TEMP-{userId-8chars}-{timestamp}` prevents collision issues

3. **Same logic in updateScheduleSettings**: The update method already had this logic, now both methods are consistent

## Default Settings Structure

When a professional record is created, it includes default schedule settings:

```json
{
  "weeklySchedule": [
    { "day": 0, "dayName": "Domingo", "enabled": false, "start": "", "end": "", "break": false },
    { "day": 1, "dayName": "Segunda", "enabled": true, "start": "08:00", "end": "17:00", "break": true, "breakStart": "12:00", "breakEnd": "13:00" },
    // ... Monday to Friday with same schedule
    { "day": 6, "dayName": "Sábado", "enabled": false, "start": "08:00", "end": "12:00", "break": false }
  ],
  "appointmentDuration": 30,
  "bufferTime": 5,
  "blockedDates": []
}
```

## Testing

1. ✅ Login as user with PROFESSIONAL role (without existing professional record)
2. ✅ Navigate to `/specialist/schedule`
3. ✅ Should load without errors and show default schedule
4. ✅ Modify and save settings
5. ✅ Reload page - settings should persist

## Files Modified

1. **`backend-primaCard/src/modules/professionals/professional.routes.ts`**
   - **Moved** `/statistics` route from line 178 → line 55 (before `:professionalId`)
   - **Moved** `/schedule-settings` GET route from line 192 → line 75 (before `:professionalId`)
   - **Moved** `:professionalId` route from line 55 → line 95 (after specific routes)
   - **Removed** duplicate route definitions

2. **`backend-primaCard/src/modules/professionals/professional.service.ts`**
   - Modified `getScheduleSettings()` method (lines 577-632)
   - Updated `updateScheduleSettings()` registration number format (line 650)

## Impact

- ✅ Routes now match correctly (specific before dynamic)
- ✅ No more "Professional not found" errors when accessing schedule settings
- ✅ Seamless user experience for new professionals
- ✅ Consistent behavior between GET and PUT operations
- ✅ No breaking changes to existing data
- ✅ Existing professional records continue to work normally
- ✅ Other professional routes (`/statistics`, `/:professionalId`) work correctly

## Important Lessons

### Express.js Route Ordering Rules 📚

1. **Specific routes MUST be defined before dynamic routes**
   ```typescript
   // ✅ CORRECT
   router.get('/statistics', ...);      // Specific
   router.get('/schedule-settings', ...); // Specific
   router.get('/:id', ...);             // Dynamic - catches everything else
   
   // ❌ WRONG
   router.get('/:id', ...);             // Catches everything!
   router.get('/statistics', ...);      // Never reached!
   router.get('/schedule-settings', ...); // Never reached!
   ```

2. **Dynamic routes catch any string**
   - `/:id` will match: `/123`, `/abc`, `/schedule-settings`, `/statistics`, etc.
   - Always define them **last**

3. **Sub-paths of dynamic routes are OK after**
   - `/:id` comes first
   - `/:id/availability` can come after (because it's more specific)
   - `/:id/procedures` can come after

## Future Improvements

Consider adding a **post-registration flow** where professionals can:
1. Enter their actual registration number (CRO, CRM, etc.)
2. Set their specialty
3. Configure their bio and location details
4. Set up their initial schedule

This would eliminate the need for placeholder values like `TEMP-*` and "Não informado".
