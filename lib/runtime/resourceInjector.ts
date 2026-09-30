export interface Resource {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  size: number;
}

export interface ResourceInjector {
  inject(resources: Resource[]): string;
  estimateTokens(resources: Resource[]): number;
}

// Default implementation - inject as labeled text blocks
export const defaultResourceInjector: ResourceInjector = {
  inject(resources: Resource[]): string {
    if (resources.length === 0) return "";

    return resources
      .map((r) => {
        const label = r.name;
        const lang = r.mimeType === "application/json" ? "json"
          : r.mimeType === "text/csv" ? "csv"
          : r.mimeType === "text/markdown" ? "markdown"
          : "text";
        return `### ${label}\n\`\`\`${lang}\n${r.content}\n\`\`\``;
      })
      .join("\n\n");
  },

  estimateTokens(resources: Resource[]): number {
    return Math.ceil(
      resources.reduce((acc, r) => acc + r.content.length, 0) / 4
    );
  },
};

// Placeholder for RAG strategy
export interface RAGStrategy {
  retrieve(query: string, resources: Resource[], topK: number): Promise<Resource[]>;
}
