import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { PhysicistApiClient, PhysicistApiError } from "../src/client/index.js";

describe("Job Polling & Waiting", () => {
  let mock: MockAdapter;
  let client: PhysicistApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new PhysicistApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    mock.restore();
    vi.useRealTimers();
  });

  it("polls job until completed status is returned", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/jobs/test-job-uuid").reply(() => {
      callCount++;
      if (callCount < 2) {
        return [200, { data: { job_id: "test-job-uuid", status: "running" } }];
      }
      return [
        200,
        {
          data: {
            job_id: "test-job-uuid",
            status: "completed",
            result: { discovered: 8 }
          }
        }
      ];
    });

    const waitPromise = client.waitForJob("test-job-uuid", 50, 1000);

    // Fast-forward fake timer
    await vi.advanceTimersByTimeAsync(150);

    const result = await waitPromise;
    expect(result.status).toBe("completed");
    expect(callCount).toBe(2);
  });

  it("throws PhysicistApiError when job fails", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/failed-job-uuid").reply(200, {
      data: {
        job_id: "failed-job-uuid",
        status: "failed",
        error: "Ollama inference connection refused"
      }
    });

    const waitPromise = client.waitForJob("failed-job-uuid", 50, 1000);
    const rejectionPromise = expect(waitPromise).rejects.toThrowError(PhysicistApiError);

    await vi.advanceTimersByTimeAsync(50);
    await rejectionPromise;
  });

  it("returns still-running job with timed_out flag when wait timeout expires", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/slow-job-uuid").reply(200, {
      data: {
        job_id: "slow-job-uuid",
        status: "running"
      }
    });

    const waitPromise = client.waitForJob("slow-job-uuid", 50, 200);

    await vi.advanceTimersByTimeAsync(300);
    const result = await waitPromise;
    expect(result.timed_out).toBe(true);
    expect(result.is_running).toBe(true);
    expect(result.status).toBe("running");
  });
});

describe("Cluster Report Polling (waitForClusterReport)", () => {
  let mock: MockAdapter;
  let client: PhysicistApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new PhysicistApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    mock.restore();
    vi.useRealTimers();
  });

  it("polls cluster report until completed", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(() => {
      callCount++;
      if (callCount < 2) {
        return [200, { data: { id: 5, status: "running", progress_percentage: 25 } }];
      }
      return [200, { data: { id: 5, status: "completed", progress_percentage: 100, content: "# Physical Monograph" } }];
    });

    const waitPromise = client.waitForClusterReport(5, 50, 1000);
    await vi.advanceTimersByTimeAsync(150);
    const report = await waitPromise;

    expect(report.status).toBe("completed");
    expect(report.content).toBe("# Physical Monograph");
  });

  it("returns still-generating report with timed_out flag when timeout is reached", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(200, {
      data: { id: 5, status: "running", progress_percentage: 45, phase_description: "Analyzing quantum cluster 12" }
    });

    const waitPromise = client.waitForClusterReport(5, 50, 200);
    await vi.advanceTimersByTimeAsync(300);
    const report = await waitPromise;

    expect(report.timed_out).toBe(true);
    expect(report.is_running).toBe(true);
    expect(report.progress_percentage).toBe(45);
  });

  it("throws PhysicistApiError when report fails", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(200, {
      data: { id: 5, status: "failed", error_message: "Synthesis cluster failure" }
    });

    const waitPromise = client.waitForClusterReport(5, 50, 1000);
    const rejectionPromise = expect(waitPromise).rejects.toThrowError(PhysicistApiError);

    await vi.advanceTimersByTimeAsync(50);
    await rejectionPromise;
  });
});
