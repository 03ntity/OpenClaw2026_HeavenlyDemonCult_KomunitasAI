import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import starterPlugin from "./plugin.ts";
import { character } from "./character.ts";
import {
  rtRwCharacter,
  arisanCharacter,
  koperasiCharacter,
  eventCharacter,
  patunganCharacter,
} from "./agents/characters.ts";

const makeInit =
  (name: string) =>
  async ({ runtime }: { runtime: IAgentRuntime }) => {
    logger.info({ name }, "Initializing KomunitasAI agent");
    try {
      const { startScheduler } = await import("./scheduler/autonomous-loop.ts");
      await startScheduler(runtime);
      logger.info({ name }, "Autonomous scheduler started");
    } catch (e) {
      logger.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "Scheduler not available — autonomous loops disabled",
      );
    }
  };

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => makeInit(character.name)({ runtime }),
  plugins: [starterPlugin],
};

const rtRwAgent: ProjectAgent = {
  character: rtRwCharacter,
  init: async (runtime: IAgentRuntime) =>
    makeInit(rtRwCharacter.name)({ runtime }),
  plugins: [starterPlugin],
};

const arisanAgent: ProjectAgent = {
  character: arisanCharacter,
  init: async (runtime: IAgentRuntime) =>
    makeInit(arisanCharacter.name)({ runtime }),
  plugins: [starterPlugin],
};

const koperasiAgent: ProjectAgent = {
  character: koperasiCharacter,
  init: async (runtime: IAgentRuntime) =>
    makeInit(koperasiCharacter.name)({ runtime }),
  plugins: [starterPlugin],
};

const eventAgent: ProjectAgent = {
  character: eventCharacter,
  init: async (runtime: IAgentRuntime) =>
    makeInit(eventCharacter.name)({ runtime }),
  plugins: [starterPlugin],
};

const patunganAgent: ProjectAgent = {
  character: patunganCharacter,
  init: async (runtime: IAgentRuntime) =>
    makeInit(patunganCharacter.name)({ runtime }),
  plugins: [starterPlugin],
};

const project: Project = {
  agents: [
    projectAgent,
    rtRwAgent,
    arisanAgent,
    koperasiAgent,
    eventAgent,
    patunganAgent,
  ],
};

export { character } from "./character.ts";

export default project;
