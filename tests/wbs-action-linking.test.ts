import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

test("NextAction creation and querying with wbs_node_id links properly", async () => {
  const snapshot = process.env.WBS_TEST_SNAPSHOT;
  if (!snapshot) return;

  const root = path.resolve(snapshot);
  const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // 1. Find a synced WBS node from test snapshot (e.g., project 8)
    const node = await prisma.wbsNode.findFirst({
      where: { project_id: 8, attributes: { path: ["active"], not: false } },
    });
    assert.ok(node, "Must have an active WbsNode in project 8");

    // 2. Create NextAction linked to this node
    const testAction = await prisma.nextAction.create({
      data: {
        project_id: 8,
        wbs_node_id: node.id,
        action_text: "تست انتساب اقدام آتی به بسته کاری WBS",
        target_date: new Date("2026-11-20T00:00:00.000Z"),
        created_by_role: "manager",
      },
      include: {
        wbsNode: { select: { id: true, code: true, title: true } },
      },
    });

    assert.equal(testAction.wbs_node_id, node.id);
    assert.equal(testAction.wbsNode?.id, node.id);
    assert.equal(testAction.wbsNode?.code, node.code);

    // 3. Query back node with its active next actions
    const reloadedNode = await prisma.wbsNode.findUniqueOrThrow({
      where: { id: node.id },
      include: {
        nextActions: { where: { is_completed: false, is_cancelled: false } },
      },
    });

    const hasAction = reloadedNode.nextActions.some((a) => a.id === testAction.id);
    assert.ok(hasAction, "Node must have the newly created NextAction in its relations");

    // 4. Clean up
    await prisma.nextAction.delete({ where: {id: testAction.id} });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});
