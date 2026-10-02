// Run: ZABBIX_URL=https://your-host/zabbix ZABBIX_TOKEN=xxx bun zabbix-poc.ts
import axios from "axios";
import { z } from "zod";

const zabbix = axios.create({
  baseURL: process.env.ZABBIX_URL,
  headers: { Authorization: `Bearer ${process.env.ZABBIX_TOKEN}` },
});

// Zabbix answers HTTP 200 even on failure; the error comes in the body.
const call = (method: string, params: object) =>
  zabbix
    .post("/api_jsonrpc.php", { id: 1, jsonrpc: "2.0", method, params })
    .then((res) => res.data)
    .then((data) => {
      if (data.error) {
        throw new Error(`${data.error.message} ${data.error.data}`);
      }
      return data.result;
    });

// --- helpers ---------------------------------------------------------------

const SEVERITY = [
  "Not classified",
  "Information",
  "Warning",
  "Average",
  "High",
  "Disaster",
];

const time = (clock: string) =>
  new Date(Number(clock) * 1000).toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });

const duration = (from: string, to?: string) => {
  const s = (to ? Number(to) : Math.floor(Date.now() / 1000)) - Number(from);
  if (s >= 86_400) {
    return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
  }
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const tags = (list: any[] = []) =>
  list.map((t) => (t.value ? `${t.tag}: ${t.value}` : t.tag));

// --- problem.get -----------------------------------------------------------

const listProblemsParams = z.object({
  acknowledged: z.boolean().optional(),
  groupids: z.array(z.string()).optional(),
  hostids: z.array(z.string()).optional(),
  limit: z.number().int().positive().default(20),
  search: z.object({ name: z.string() }).optional(),
  severities: z.array(z.number().int().min(0).max(5)).optional(),
  time_from: z.number().int().optional().describe("Unix timestamp in seconds"),
});

async function listProblems(input: z.input<typeof listProblemsParams> = {}) {
  const problems: any[] = await call("problem.get", {
    ...listProblemsParams.parse(input),
    output: "extend",
    selectTags: "extend",
    sortfield: ["eventid"],
    sortorder: "DESC",
  });

  // problem.get doesn't return hosts, so fetch them in one extra call.
  const events: any[] = await call("event.get", {
    eventids: problems.map((p) => p.eventid),
    output: ["eventid"],
    selectHosts: ["name"],
  });
  const hostOf = Object.fromEntries(
    events.map((e) => [e.eventid, e.hosts.map((h: any) => h.name).join(", ")])
  );

  return problems.map((p) => ({
    acknowledged: p.acknowledged === "1",
    duration: duration(p.clock),
    eventid: p.eventid,
    host: hostOf[p.eventid] ?? "unknown",
    problem: p.name,
    severity: SEVERITY[Number(p.severity)],
    tags: tags(p.tags),
    time: time(p.clock),
  }));
}

// --- event.get -------------------------------------------------------------

const getEventParams = z.object({ eventid: z.string() });

const getEvent = (input: z.input<typeof getEventParams>) =>
  call("event.get", {
    eventids: [getEventParams.parse(input).eventid],
    output: "extend",
    selectAcknowledges: ["clock", "message"], // `select_acknowledges` before Zabbix 7.0
    selectHosts: ["name"],
    selectRelatedObject: ["description", "comments"],
    selectTags: "extend",
  }).then(([e]: any[]) =>
    e
      ? {
          acknowledged: e.acknowledged === "1",
          comments: (e.acknowledges ?? [])
            .filter((a: any) => a.message)
            .map((a: any) => `${time(a.clock)} - ${a.message}`),
          duration: e.r_eventid === "0" ? duration(e.clock) : undefined,
          eventid: e.eventid,
          host: e.hosts.map((h: any) => h.name).join(", "),
          operational_data: e.opdata || undefined,
          problem: e.name,
          recovery_eventid: e.r_eventid === "0" ? undefined : e.r_eventid,
          severity: SEVERITY[Number(e.severity)],
          status: e.r_eventid === "0" ? "PROBLEM" : "RESOLVED",
          tags: tags(e.tags),
          time: time(e.clock),
          trigger: e.relatedObject?.description,
          trigger_notes: e.relatedObject?.comments || undefined,
        }
      : null
  );

// --- run -------------------------------------------------------------------

const problems = await listProblems({ limit: 50, severities: [4, 5] });
console.log(problems);

if (problems[0]) {
  console.log(await getEvent({ eventid: problems[0].eventid }));
}
