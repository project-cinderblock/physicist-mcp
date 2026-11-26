import axios, { AxiosInstance, AxiosError } from "axios";
import { ServerConfig } from "../config.js";
import {
  ApiResponse,
  PlatformStatus,
  PlatformSettings,
  ParticleGroup,
  SubatomicParticle,
  QuantumState,
  LiveClusterResult,
  ClusterSnapshot,
  ClusterGroup,
  ClusterReport,
  ClusterReportSummary,
  ClusterSubReport,
  JobStatus
} from "./types.js";

export class PhysicistApiError extends Error {
  public code: string;
  public status?: number;
  public details?: string[];

  constructor(message: string, code = "api_error", status?: number, details?: string[]) {
    super(message);
    this.name = "PhysicistApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PhysicistApiClient {
  private http: AxiosInstance;
  public readonly apiUrl: string;

  constructor(config: ServerConfig) {
    this.apiUrl = config.apiUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    this.http = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs,
      headers
    });
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: { code?: string; message?: string; details?: string[] } }>;
      const status = axiosErr.response?.status;
      const errorPayload = axiosErr.response?.data?.error;

      if (errorPayload) {
        throw new PhysicistApiError(
          errorPayload.message || axiosErr.message,
          errorPayload.code || "api_error",
          status,
          errorPayload.details
        );
      }

      throw new PhysicistApiError(
        axiosErr.message,
        status ? `http_${status}` : "network_error",
        status
      );
    }

    if (error instanceof Error) {
      throw new PhysicistApiError(error.message);
    }

    throw new PhysicistApiError(String(error));
  }

  // System & Status
  async getStatus(): Promise<PlatformStatus> {
    try {
      const res = await this.http.get<ApiResponse<PlatformStatus>>("/status");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    try {
      const res = await this.http.get<Record<string, unknown>>("/openapi.json");
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      const res = await this.http.get<ApiResponse<PlatformSettings>>("/settings");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateContextWindow(contextWindow: number): Promise<unknown> {
    try {
      const res = await this.http.patch<ApiResponse<unknown>>("/settings/context_window", {
        context_window: contextWindow
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateBulkEmbeddings(modelType: "SubatomicParticle" | "QuantumState", onlyMissing = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/settings/generate_embeddings", {
        model_type: modelType,
        only_missing: onlyMissing
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Global Search
  async search(params: {
    q: string;
    mode?: "semantic" | "keyword" | "auto";
    target_type?: "all" | "subatomic_particle" | "quantum_state";
    limit?: number;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.http.get<ApiResponse<unknown>>("/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Particle Groups
  async listParticleGroups(params?: {
    q?: string;
    include_subatomic_particles?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ParticleGroup[]>> {
    try {
      const res = await this.http.get<ApiResponse<ParticleGroup[]>>("/particle_groups", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getParticleGroup(id: number, params?: { include_subatomic_particles?: boolean }): Promise<ParticleGroup> {
    try {
      const res = await this.http.get<ApiResponse<ParticleGroup>>(`/particle_groups/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createParticleGroup(particle_group: { name: string; description?: string }): Promise<ParticleGroup> {
    try {
      const res = await this.http.post<ApiResponse<ParticleGroup>>("/particle_groups", { particle_group });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateParticleGroup(id: number, particle_group: { name?: string; description?: string }): Promise<ParticleGroup> {
    try {
      const res = await this.http.patch<ApiResponse<ParticleGroup>>(`/particle_groups/${id}`, { particle_group });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteParticleGroup(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(`/particle_groups/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertParticleGroupsBatch(
    particle_groups: Array<{ name: string; description?: string }>
  ): Promise<ApiResponse<ParticleGroup[]>> {
    try {
      const res = await this.http.post<ApiResponse<ParticleGroup[]>>("/particle_groups/upsert_batch", {
        particle_groups
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateParticleGroups(sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/particle_groups/populate",
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateParticleGroupSubatomicParticles(particleGroupId: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/particle_groups/${particleGroupId}/populate_subatomic_particles`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Subatomic Particles
  async listSubatomicParticles(params?: {
    particle_group_id?: number;
    particle_group?: string;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_quantum_states?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<SubatomicParticle[]>> {
    try {
      const res = await this.http.get<ApiResponse<SubatomicParticle[]>>("/subatomic_particles", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSubatomicParticle(id: number, params?: { include_embedding?: boolean; include_quantum_states?: boolean }): Promise<SubatomicParticle> {
    try {
      const res = await this.http.get<ApiResponse<SubatomicParticle>>(`/subatomic_particles/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createSubatomicParticle(subatomic_particle: {
    particle_group_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<SubatomicParticle> {
    try {
      const res = await this.http.post<ApiResponse<SubatomicParticle>>("/subatomic_particles", { subatomic_particle });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateSubatomicParticle(
    id: number,
    subatomic_particle: {
      name?: string;
      description?: string;
      themes?: string[];
      particle_group_id?: number;
    }
  ): Promise<SubatomicParticle> {
    try {
      const res = await this.http.patch<ApiResponse<SubatomicParticle>>(`/subatomic_particles/${id}`, { subatomic_particle });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteSubatomicParticle(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(`/subatomic_particles/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertSubatomicParticlesBatch(
    particleGroupId: number,
    subatomic_particles: Array<{
      name: string;
      description?: string;
      themes?: string[];
    }>
  ): Promise<ApiResponse<SubatomicParticle[]>> {
    try {
      const res = await this.http.post<ApiResponse<SubatomicParticle[]>>("/subatomic_particles/upsert_batch", {
        particle_group_id: particleGroupId,
        subatomic_particles
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSubatomicParticleNeighbors(
    id: number,
    params?: { limit?: number; particle_group_id?: number; include_embedding?: boolean }
  ): Promise<SubatomicParticle[]> {
    try {
      const res = await this.http.get<ApiResponse<SubatomicParticle[]>>(`/subatomic_particles/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateSubatomicParticleEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/subatomic_particles/${id}/generate_embedding`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateSubatomicParticleQuantumStates(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/subatomic_particles/${id}/populate_quantum_states`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateSubatomicParticles(particleGroupId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/subatomic_particles/populate",
        {},
        {
          params: { particle_group_id: particleGroupId, sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Quantum States
  async listQuantumStates(params?: {
    subatomic_particle_id?: number;
    particle_group_id?: number;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<QuantumState[]>> {
    try {
      const res = await this.http.get<ApiResponse<QuantumState[]>>("/quantum_states", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getQuantumState(id: number, params?: { include_embedding?: boolean }): Promise<QuantumState> {
    try {
      const res = await this.http.get<ApiResponse<QuantumState>>(`/quantum_states/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createQuantumState(quantum_state: {
    subatomic_particle_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<QuantumState> {
    try {
      const res = await this.http.post<ApiResponse<QuantumState>>("/quantum_states", { quantum_state });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateQuantumState(
    id: number,
    quantum_state: {
      name?: string;
      description?: string;
      themes?: string[];
      subatomic_particle_id?: number;
    }
  ): Promise<QuantumState> {
    try {
      const res = await this.http.patch<ApiResponse<QuantumState>>(`/quantum_states/${id}`, { quantum_state });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteQuantumState(id: number): Promise<{ id: number; subatomic_particle_id: number; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; subatomic_particle_id: number; deleted: boolean }>>(
        `/quantum_states/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertQuantumStatesBatch(
    subatomicParticleId: number,
    quantum_states: Array<{
      name: string;
      description?: string;
      themes?: string[];
    }>
  ): Promise<ApiResponse<QuantumState[]>> {
    try {
      const res = await this.http.post<ApiResponse<QuantumState[]>>("/quantum_states/upsert_batch", {
        subatomic_particle_id: subatomicParticleId,
        quantum_states
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getQuantumStateNeighbors(
    id: number,
    params?: { limit?: number; subatomic_particle_id?: number; particle_group_id?: number; include_embedding?: boolean }
  ): Promise<QuantumState[]> {
    try {
      const res = await this.http.get<ApiResponse<QuantumState[]>>(`/quantum_states/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateQuantumStateEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/quantum_states/${id}/generate_embedding`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateQuantumStates(subatomicParticleId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/quantum_states/populate",
        {},
        {
          params: { subatomic_particle_id: subatomicParticleId, sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Clusters & Snapshots
  async computeClusters(params?: {
    target_type?: "SubatomicParticle" | "QuantumState";
    level?: number;
    full_coverage?: boolean;
    force?: boolean;
  }): Promise<LiveClusterResult> {
    try {
      const res = await this.http.get<ApiResponse<LiveClusterResult>>("/clusters", { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterSnapshot(data: {
    target_type: "SubatomicParticle" | "QuantumState";
    level: number;
    full_coverage?: boolean;
    title: string;
  }): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.post<ApiResponse<ClusterSnapshot>>("/clusters/snapshot", data);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSnapshots(params?: {
    target_type?: "SubatomicParticle" | "QuantumState";
    include_groups?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterSnapshot[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot[]>>("/cluster_snapshots", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSnapshot(
    id: number,
    params?: {
      include_groups?: boolean;
      include_members?: boolean;
      include_reports?: boolean;
    }
  ): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot>>(`/cluster_snapshots/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterSnapshot(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_snapshots/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterGroups(
    clusterSnapshotId: number,
    params?: { include_members?: boolean }
  ): Promise<ApiResponse<ClusterGroup[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup[]>>(
        `/cluster_snapshots/${clusterSnapshotId}/cluster_groups`,
        { params }
      );
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterGroup(id: number, params?: { include_members?: boolean }): Promise<ClusterGroup> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup>>(`/cluster_groups/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Synthesis Reports
  async listClusterReports(params?: {
    cluster_snapshot_id?: number;
    target_type?: "SubatomicParticle" | "QuantumState";
    status?: string;
    is_detailed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterReport[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport[]>>("/cluster_reports", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReport(
    id: number,
    params?: {
      include_summaries?: boolean;
      include_sub_reports?: boolean;
    }
  ): Promise<ClusterReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport>>(`/cluster_reports/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterReport(data: {
    cluster_snapshot_id: number;
    prompt: string;
  }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>("/cluster_reports", data);
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterReport(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_reports/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deepSynthesis(reportId: number, data?: { batch_size?: number }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>(
        `/cluster_reports/${reportId}/deep_synthesis`,
        data || {}
      );
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForClusterReport(
    id: number,
    pollIntervalMs = 5000,
    timeoutMs = 600000
  ): Promise<ClusterReport> {
    const startTime = Date.now();
    let lastReport: ClusterReport | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const report = await this.getClusterReport(id, {
        include_summaries: false,
        include_sub_reports: false
      });
      lastReport = report;
      if (report.status === "completed") {
        return await this.getClusterReport(id, {
          include_summaries: false,
          include_sub_reports: true
        });
      }
      if (report.status === "failed") {
        throw new PhysicistApiError(
          report.error_message || `Cluster report ${id} failed`,
          "report_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastReport && (lastReport.status === "running" || lastReport.status === "queued")) {
      return {
        ...lastReport,
        timed_out: true,
        is_running: true
      };
    }
    throw new PhysicistApiError(
      `Cluster report ${id} timed out after ${timeoutMs}ms while waiting for completion`,
      "report_timeout"
    );
  }

  async listClusterReportSummaries(clusterReportId: number): Promise<ClusterReportSummary[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary[]>>(
        `/cluster_reports/${clusterReportId}/summaries`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReportSummary(id: number): Promise<ClusterReportSummary> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary>>(`/cluster_report_summaries/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSubReports(clusterReportId: number): Promise<ClusterSubReport[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport[]>>(
        `/cluster_reports/${clusterReportId}/sub_reports`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSubReport(id: number): Promise<ClusterSubReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport>>(`/cluster_sub_reports/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Jobs
  async listJobs(limit = 20): Promise<JobStatus[]> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus[]>>("/jobs", { params: { limit } });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getJob(jobId: string): Promise<JobStatus> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus>>(`/jobs/${jobId}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForJob(jobId: string, pollIntervalMs = 2000, timeoutMs = 60000): Promise<JobStatus> {
    const startTime = Date.now();
    let lastJob: JobStatus | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJob(jobId);
      lastJob = job;
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new PhysicistApiError(
          job.error || job.message || `Job ${jobId} failed`,
          "job_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastJob && (lastJob.status === "running" || lastJob.status === "queued")) {
      return {
        ...lastJob,
        timed_out: true,
        is_running: true,
        message: `Job ${jobId} is still ${lastJob.status} in the background after ${timeoutMs}ms. Do NOT retry or duplicate.`
      };
    }
    throw new PhysicistApiError(
      `Job ${jobId} timed out after ${timeoutMs}ms while waiting for completion`,
      "job_timeout"
    );
  }
}
