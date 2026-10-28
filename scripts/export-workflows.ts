import { mkdirSync, writeFileSync } from "node:fs";
import { templates } from "../lib/workflows/templates";
mkdirSync("examples/workflows", { recursive: true });
for (const template of templates)
  writeFileSync(
    `examples/workflows/${template.id}.json`,
    JSON.stringify(
      {
        name: template.name,
        description: template.description,
        graph: template.graph,
      },
      null,
      2,
    ) + "\n",
  );
writeFileSync(
  "examples/workflows/inputs.json",
  JSON.stringify(
    Object.fromEntries(templates.map((t) => [t.id, t.input])),
    null,
    2,
  ) + "\n",
);
console.log(`Exported ${templates.length} workflow examples.`);
