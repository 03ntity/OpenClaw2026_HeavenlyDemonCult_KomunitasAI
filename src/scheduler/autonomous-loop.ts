import type { IAgentRuntime, TaskWorker } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { KomunitasService } from "../plugins/komunitas-service.ts";

const BILLING_TASK = "KOMUNITAS_BILLING_LOOP";
const MONITORING_TASK = "KOMUNITAS_MONITORING_LOOP";
const REPORT_TASK = "KOMUNITAS_REPORT_LOOP";
export const COMMUNITY_WORKFLOW_TASK = "KOMUNITAS_COMMUNITY_WORKFLOW";

const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function isFirstDayOfMonth(): boolean {
  return new Date().getDate() === 1;
}

function isLastDayOfMonth(): boolean {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== now.getMonth();
}

async function getService(
  runtime: IAgentRuntime,
): Promise<KomunitasService | null> {
  const service = runtime.getService(
    KomunitasService.serviceType,
  ) as KomunitasService | null;
  if (!service) {
    logger.warn("KomunitasService not available for task worker");
  }
  return service;
}

export const billingTaskWorker: TaskWorker = {
  name: BILLING_TASK,
  async execute(runtime, _options, _task) {
    if (!isFirstDayOfMonth()) {
      logger.debug("Billing loop skipped — not first day of month");
      return;
    }
    const service = await getService(runtime);
    if (!service) return;

    try {
      const communities = await service.listCommunities();
      for (const community of communities) {
        const result = await service.bulkCreateInvoices({
          communityId: community.id,
        });
        logger.info(
          {
            community: community.name,
            created: result.created.length,
            skipped: result.skipped.length,
          },
          "Billing loop completed",
        );
      }
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e) },
        "Billing loop failed",
      );
    }
  },
};

export const monitoringTaskWorker: TaskWorker = {
  name: MONITORING_TASK,
  async execute(runtime, _options, _task) {
    const service = await getService(runtime);
    if (!service) return;

    try {
      const communities = await service.listCommunities();
      for (const community of communities) {
        const result = await service.checkPendingPayments(community.id);
        logger.info(
          {
            community: community.name,
            checked: result.checked.length,
            paid: result.paid.length,
          },
          "Monitoring loop completed",
        );
      }
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e) },
        "Monitoring loop failed",
      );
    }
  },
};

export const reportTaskWorker: TaskWorker = {
  name: REPORT_TASK,
  async execute(runtime, _options, _task) {
    if (!isLastDayOfMonth()) {
      logger.debug("Report loop skipped — not last day of month");
      return;
    }
    const service = await getService(runtime);
    if (!service) return;

    try {
      const communities = await service.listCommunities();
      for (const community of communities) {
        const report = await service.generateMonthlyReport(community.id);
        await service.detectPaymentAnomaly(community.id);
        logger.info(
          {
            community: community.name,
            month: report.month,
            collected: report.totalCollected,
            rate: report.collectionRate,
          },
          "Report loop completed",
        );
      }
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e) },
        "Report loop failed",
      );
    }
  },
};

export const communityWorkflowTaskWorker: TaskWorker = {
  name: COMMUNITY_WORKFLOW_TASK,
  async execute(runtime, options, task) {
    const service = await getService(runtime);
    if (!service) return;

    const communityId = String(
      options.communityId ?? task.metadata?.communityId ?? "",
    );
    if (!communityId) {
      logger.warn({ taskId: task.id }, "Community workflow task missing communityId");
      return;
    }

    const result: Record<string, unknown> = {};
    try {
      result.billing = await service.bulkCreateInvoices({ communityId });
    } catch (err) {
      result.billingError = err instanceof Error ? err.message : String(err);
      logger.warn({ communityId, err }, "Community workflow billing step failed");
    }

    try {
      result.monitoring = await service.checkPendingPayments(communityId);
    } catch (err) {
      result.monitoringError = err instanceof Error ? err.message : String(err);
      logger.warn(
        { communityId, err },
        "Community workflow payment monitoring step failed",
      );
    }

    try {
      result.reminders = await service.sendPaymentReminders({ communityId });
    } catch (err) {
      result.reminderError = err instanceof Error ? err.message : String(err);
      logger.warn({ communityId, err }, "Community workflow reminder step failed");
    }

    await service.recordScheduledWorkflowCompleted(communityId, result);
    logger.info({ communityId, taskId: task.id }, "Community workflow task completed");
  },
};

export async function startScheduler(runtime: IAgentRuntime): Promise<void> {
  runtime.registerTaskWorker(billingTaskWorker);
  runtime.registerTaskWorker(monitoringTaskWorker);
  runtime.registerTaskWorker(reportTaskWorker);
  runtime.registerTaskWorker(communityWorkflowTaskWorker);

  const existingTasks = await runtime.getTasks({
    tags: ["komunitas-scheduler"],
  });
  const existingNames = new Set(existingTasks.map((t) => t.name));

  if (!existingNames.has(BILLING_TASK)) {
    await runtime.createTask({
      name: BILLING_TASK,
      description:
        "Monthly billing loop — creates invoices for all communities on day 1",
      tags: ["komunitas-scheduler", "repeat"],
      metadata: {
        updateInterval: ONE_DAY_MS,
      },
    });
    logger.info("Billing task worker registered (daily check, fires on day 1)");
  }

  if (!existingNames.has(MONITORING_TASK)) {
    await runtime.createTask({
      name: MONITORING_TASK,
      description:
        "Payment monitoring loop — checks pending invoices every 6 hours",
      tags: ["komunitas-scheduler", "repeat"],
      metadata: {
        updateInterval: SIX_HOURS_MS,
      },
    });
    logger.info("Monitoring task worker registered (every 6 hours)");
  }

  if (!existingNames.has(REPORT_TASK)) {
    await runtime.createTask({
      name: REPORT_TASK,
      description:
        "Monthly report loop — generates reports on last day of month",
      tags: ["komunitas-scheduler", "repeat"],
      metadata: {
        updateInterval: ONE_DAY_MS,
      },
    });
    logger.info(
      "Report task worker registered (daily check, fires on last day)",
    );
  }

  logger.info("KomunitasAI autonomous task workers started");
}

export async function runBillingLoopManual(
  runtime: IAgentRuntime,
): Promise<void> {
  await billingTaskWorker.execute(runtime, {}, {} as any);
}

export async function runMonitoringLoopManual(
  runtime: IAgentRuntime,
): Promise<void> {
  await monitoringTaskWorker.execute(runtime, {}, {} as any);
}

export async function runReportLoopManual(
  runtime: IAgentRuntime,
): Promise<void> {
  await reportTaskWorker.execute(runtime, {}, {} as any);
}
