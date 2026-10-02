import { z } from "zod";

const id = z.string().regex(/^\d+$/);

const severity = z
  .number()
  .int()
  .min(0)
  .max(5)
  .describe(
    "0=not classified, 1=information, 2=warning, 3=average, 4=high, 5=disaster"
  );

const tagFilter = z.object({
  operator: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe(
      "0=contains (default), 1=equals, 2=not like, 3=not equal, 4=exists, 5=not exists"
    ),
  tag: z.string(),
  value: z.string().optional(),
});

const tag = z.object({ tag: z.string(), value: z.string() }).passthrough();

const acknowledge = z
  .object({
    acknowledgeid: id,
    action: z.string(),
    clock: z.string(),
    message: z.string(),
    new_severity: z.string(),
    old_severity: z.string(),
    userid: id,
  })
  .passthrough();

export const listProblemsParams = z.object({
  acknowledged: z
    .boolean()
    .optional()
    .describe("true=only acknowledged, false=only unacknowledged"),
  evaltype: z
    .union([z.literal(0), z.literal(2)])
    .optional()
    .describe("Tag matching: 0=and/or (default), 2=or"),
  eventids: z.array(id).optional(),
  groupids: z
    .array(id)
    .optional()
    .describe("Only problems in these host groups"),
  hostids: z.array(id).optional().describe("Only problems on these hosts"),
  limit: z.number().int().positive().max(500).default(50),
  objectids: z
    .array(id)
    .optional()
    .describe("Only problems from these trigger IDs"),
  output: z.union([z.literal("extend"), z.array(z.string())]).default("extend"),
  recent: z
    .boolean()
    .optional()
    .describe("true=also include recently resolved problems"),
  search: z
    .object({ name: z.string() })
    .optional()
    .describe("Case-insensitive substring match on the problem name"),
  selectAcknowledges: z.literal("extend").optional(), // `select_acknowledges` before Zabbix 7.0
  selectTags: z.literal("extend").optional(),
  severities: z.array(severity).optional(),
  sortfield: z.array(z.literal("eventid")).default(["eventid"]),
  sortorder: z.enum(["ASC", "DESC"]).default("DESC"),
  suppressed: z
    .boolean()
    .optional()
    .describe("true=only suppressed (maintenance), false=only unsuppressed"),
  tags: z.array(tagFilter).optional(),
  time_from: z
    .number()
    .int()
    .optional()
    .describe("Unix timestamp (seconds), inclusive"),
  time_till: z
    .number()
    .int()
    .optional()
    .describe("Unix timestamp (seconds), inclusive"),
});

export const problem = z
  .object({
    acknowledged: z.string().describe("'0' or '1'"),
    acknowledges: z.array(acknowledge).optional(),
    clock: z.string().describe("Unix timestamp when the problem started"),
    eventid: id,
    name: z.string(),
    ns: z.string(),
    object: z.string(),
    objectid: id.describe("Trigger ID"),
    opdata: z.string().optional(),
    r_clock: z.string(),
    r_eventid: z.string().describe("Recovery event ID, '0' if still open"),
    severity: z.string(),
    source: z.string(),
    suppressed: z.string().describe("'0' or '1'"),
    tags: z.array(tag).optional(),
  })
  .passthrough();

export const listProblemsResult = z.array(problem);

// ---------------------------------------------------------------------------
// event.get — problem details
// ---------------------------------------------------------------------------

export const getEventParams = z.object({
  eventids: z.array(id).min(1),
  output: z.union([z.literal("extend"), z.array(z.string())]).default("extend"),
  selectAcknowledges: z.literal("extend").default("extend"), // `select_acknowledges` before 7.0
  selectAlerts: z.union([z.literal("extend"), z.array(z.string())]).optional(), // `select_alerts` before 7.0
  selectHosts: z
    .union([z.literal("extend"), z.array(z.string())])
    .default(["hostid", "host", "name"]),
  selectRelatedObject: z
    .union([z.literal("extend"), z.array(z.string())])
    .default(["triggerid", "description", "expression", "priority"]),
  selectTags: z.literal("extend").default("extend"),
});

export const event = z
  .object({
    acknowledged: z.string(),
    acknowledges: z.array(acknowledge).optional(),
    alerts: z
      .array(
        z
          .object({
            alertid: id,
            clock: z.string().optional(),
            sendto: z.string().optional(),
            status: z.string().optional(),
            subject: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
    c_eventid: z.string().optional(),
    clock: z.string(),
    correlationid: z.string().optional(),
    eventid: id,
    hosts: z
      .array(
        z
          .object({
            host: z.string().optional(),
            hostid: id,
            name: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
    name: z.string(),
    ns: z.string(),
    object: z.string(),
    objectid: id,
    opdata: z.string().optional(),
    r_eventid: z.string().describe("Recovery event ID, '0' if still open"),
    // Zabbix returns [] instead of an object when the trigger no longer exists
    relatedObject: z
      .union([
        z
          .object({
            description: z.string().optional(),
            expression: z.string().optional(),
            priority: z.string().optional(),
            triggerid: id,
          })
          .passthrough(),
        z.array(z.never()),
      ])
      .optional(),
    severity: z.string(),
    source: z.string(),
    suppressed: z.string(),
    tags: z.array(tag).optional(),
    userid: z.string().optional(),
    value: z.string().describe("'1'=problem, '0'=OK/recovery"),
  })
  .passthrough();

export const getEventResult = z.array(event);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListProblemsParams = z.infer<typeof listProblemsParams>;
export type Problem = z.infer<typeof problem>;
export type GetEventParams = z.infer<typeof getEventParams>;
export type ZabbixEvent = z.infer<typeof event>;
