import type { NodeSession } from "../plugins/nodeManager/shared";
import {
  pluginMethods,
  NodeManagerPlugin,
} from "../plugins/nodeManager/shared";

const nodeManagerPlugin = createNodeManagerPlugin();

const startAndOnboardNode = (
  handle: string
): Cypress.Chainable<NodeSession> => {
  return nodeManagerPlugin.startNode().then(id => {
    cy.log(`Started node ${id}`);
    return nodeManagerPlugin.onboardNode({
      id,
      handle,
      passphrase: "radicle-upstream",
    });
  });
};

const withNodeManager = (callback: () => void): void => {
  nodeManagerPlugin.stopAllNodes();
  callback();
  nodeManagerPlugin.stopAllNodes();
};

interface WithTwoOnboardedNodesOptions {
  node1Handle?: string;
  node2Handle?: string;
}

export const connectTwoNodes = (
  node1: NodeSession,
  node2: NodeSession
): void => {
  cy.log(`adding node ${node2.id} as seed to node ${node1.id}`);
  nodeManagerPlugin.connectNodes({ nodeIds: [node1.id, node2.id] });
};

export const withTwoOnboardedNodes = (
  options: WithTwoOnboardedNodesOptions,
  callback: (node1: NodeSession, node2: NodeSession) => void
): void => {
  withNodeManager(() => {
    startAndOnboardNode(options.node1Handle || "secretariat-1").then(node0 => {
      startAndOnboardNode(options.node2Handle || "secretariat-2").then(
        node1 => {
          callback(node0, node1);
        }
      );
    });
  });
};

export const asNode = (node: NodeSession): void => {
  cy.log(`switching UI to node ${node.id}`);

  cy.setCookie("auth-token", node.authToken);
  // NB: it is important that we pass `localhost` instead of `127.0.0.1` here.
  // I haven't figured out why, but when we use `127.0.0.1` instead of
  // `localhost`, the app loads with a auth-cookie mismatch error.
  cy.visit(`./public/index.html?backend=localhost:${node.httpPort}`);
};

// Replaces the return type `Promise<S>` of the function type `T` with
// `Cypress.Chainable<S>`.
//
// For example, if
//
//    T ≡ (foo: number) => Promise<string>
//
// then
//
//    ChainableReturn<T> ≡ (foo: number) => Cypress.Chainable<string>
//
type ChainableReturn<T> = T extends (...params: infer P) => Promise<infer R>
  ? (...params: P) => Cypress.Chainable<R>
  : never;

// Replaces the return type `Promise<S>` of the all the properties in
// the API object `R` with `Cypress.Chainable<S>`.
//
// For example, if
//
//    R ≡ { bar: (foo: number) => Promise<string> }
//
// then
//
//    ChainableApi<R> ≡ { bar: (foo: number) => Cypress.Chainable<string> }
//
type ChainableApi<R> = {
  [K in keyof R]: ChainableReturn<R[K]>;
};

function createNodeManagerPlugin(): ChainableApi<NodeManagerPlugin> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeManagerPlugin: any = {};
  pluginMethods.forEach(task => {
    nodeManagerPlugin[task] = (arg: unknown) =>
      cy.task(task, arg, { log: false });
  });
  return nodeManagerPlugin;
}
