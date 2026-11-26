import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { PhysicistApiClient } from "../src/client/index.js";
import { registerAllTools } from "../src/tools/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerPrompts } from "../src/prompts/index.js";

describe("MCP Server Tool, Resource, and Prompt Execution", () => {
  let mock: MockAdapter;
  let server: McpServer;
  let client: PhysicistApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    server = new McpServer(
      { name: "physicist-test", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    client = new PhysicistApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
    registerAllTools(server, client);
    registerResources(server, client);
    registerPrompts(server);
  });

  afterEach(() => {
    mock.restore();
  });

  it("registers all 51 expected tools across all 8 domains", () => {
    const registeredToolNames = Object.keys((server as any)._registeredTools);

    const expectedTools = [
      // Search (2)
      "search",
      "find_counterparts",
      // Particle Groups (8)
      "list_particle_groups",
      "get_particle_group",
      "create_particle_group",
      "update_particle_group",
      "delete_particle_group",
      "upsert_particle_groups_batch",
      "populate_particle_groups",
      "populate_particle_group_subatomic_particles",
      // Subatomic Particles (9)
      "list_subatomic_particles",
      "get_subatomic_particle",
      "create_subatomic_particle",
      "update_subatomic_particle",
      "delete_subatomic_particle",
      "upsert_subatomic_particles_batch",
      "generate_subatomic_particle_embedding",
      "populate_subatomic_particle_quantum_states",
      "populate_subatomic_particles_bulk",
      // Quantum States (8)
      "list_quantum_states",
      "get_quantum_state",
      "create_quantum_state",
      "update_quantum_state",
      "delete_quantum_state",
      "upsert_quantum_states_batch",
      "generate_quantum_state_embedding",
      "populate_quantum_states_bulk",
      // Clusters & Snapshots (7)
      "compute_clusters",
      "create_cluster_snapshot",
      "list_cluster_snapshots",
      "get_cluster_snapshot",
      "delete_cluster_snapshot",
      "list_cluster_groups",
      "get_cluster_group",
      // Reports (10)
      "list_cluster_reports",
      "get_cluster_report",
      "create_cluster_report",
      "delete_cluster_report",
      "generate_deep_synthesis",
      "wait_for_cluster_report",
      "list_report_summaries",
      "get_report_summary",
      "list_report_sub_reports",
      "get_report_sub_report",
      // Jobs (3)
      "list_jobs",
      "get_job_status",
      "wait_for_job",
      // System (5)
      "get_platform_status",
      "get_settings",
      "update_context_window",
      "trigger_bulk_embeddings",
      "get_openapi_spec"
    ];

    for (const tool of expectedTools) {
      expect(registeredToolNames).toContain(tool);
    }
    expect(registeredToolNames.length).toBe(expectedTools.length);
  });

  it("executes get_platform_status tool cleanly", async () => {
    const mockStatus = {
      status: "ok",
      environment: "production",
      counts: { particle_groups: 10, subatomic_particles: 200 }
    };
    mock.onGet("http://localhost:3000/api/v1/status").reply(200, { data: mockStatus });

    const tool = (server as any)._registeredTools["get_platform_status"];
    const response = await tool.handler({}, {});

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe("text");
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe("ok");
    expect(parsed.counts.subatomic_particles).toBe(200);
  });

  it("executes search tool and returns formatted JSON", async () => {
    const mockHit = [{ type: "SubatomicParticle", data: { id: 1, name: "Top Quark" } }];
    mock.onGet("http://localhost:3000/api/v1/search").reply(200, { data: mockHit });

    const tool = (server as any)._registeredTools["search"];
    const response = await tool.handler({ q: "heavy fermion top quark", mode: "auto", target_type: "all", limit: 10 }, {});

    expect(response.content).toBeDefined();
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.data[0].data.name).toBe("Top Quark");
  });

  it("executes find_counterparts for subatomic_particle and quantum_state", async () => {
    mock
      .onGet("http://localhost:3000/api/v1/subatomic_particles/5/neighbors")
      .reply(200, { data: [{ id: 6, name: "Neutron", neighbor_distance: 0.05 }] });

    const tool = (server as any)._registeredTools["find_counterparts"];
    const res = await tool.handler({ entity_type: "subatomic_particle", id: 5, limit: 5, include_embedding: false }, {});

    expect(res.content).toBeDefined();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed[0].name).toBe("Neutron");
  });

  it("handles tool errors with isError flag and message", async () => {
    mock.onGet("http://localhost:3000/api/v1/particle_groups/999").reply(500, {
      error: { code: "internal_error", message: "Database connection failed" }
    });

    const tool = (server as any)._registeredTools["get_particle_group"];
    const response = await tool.handler({ id: 999, include_subatomic_particles: true }, {});

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Database connection failed");
  });

  it("registers resources correctly", () => {
    const registeredResources = (server as any)._registeredResources;
    const registeredTemplates = (server as any)._registeredResourceTemplates;

    expect(registeredResources["physicist://status"]).toBeDefined();
    expect(registeredResources["physicist://particle-groups"]).toBeDefined();
    expect(Object.keys(registeredTemplates)).toHaveLength(2);
  });

  it("registers both MCP prompts", () => {
    const registeredPrompts = (server as any)._registeredPrompts;
    expect(registeredPrompts["comparative_particle_analysis"]).toBeDefined();
    expect(registeredPrompts["quantum_cluster_monograph"]).toBeDefined();

    const promptObj = registeredPrompts["comparative_particle_analysis"];
    const res = promptObj.callback({
      entity_a: "Proton",
      entity_b: "Neutron",
      entity_type: "subatomic_particle"
    });
    expect(res.description).toContain("Comparative particle physics analysis");
    expect(res.messages[0].content.text).toContain("Proton");
    expect(res.messages[0].content.text).toContain("Neutron");
  });
});
