/**
 * Merge Preview Verification Test
 *
 * Verifies that the merge-preview endpoint correctly detects conflicts
 * using git merge-tree --write-tree for non-destructive merge simulation.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTempDirPath, cleanupTempDir, createTestGitRepo } from '../utils';

const execAsync = promisify(exec);
const TEST_TEMP_DIR = createTempDirPath('merge-preview-tests');
const API_BASE_URL = 'http://localhost:3008';

interface TestRepo {
  path: string;
  cleanup: () => Promise<void>;
}

interface MergeConflict {
  filePath: string;
  conflictType: string;
  description: string;
}

interface MergePreviewResponse {
  success: boolean;
  hasConflicts: boolean;
  conflictCount: number;
  conflicts: MergeConflict[];
  mergeBase?: string;
  resultTree?: string;
  sourceBranch?: string;
  targetBranch?: string;
  error?: string;
}

test.describe('Merge Preview API', () => {
  let testRepo: TestRepo;

  test.beforeAll(async () => {
    if (!fs.existsSync(TEST_TEMP_DIR)) {
      fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  test.beforeEach(async () => {
    testRepo = await createTestGitRepo(TEST_TEMP_DIR);
  });

  test.afterEach(async () => {
    if (testRepo) {
      await testRepo.cleanup();
    }
  });

  test.afterAll(async () => {
    cleanupTempDir(TEST_TEMP_DIR);
  });

  test('should detect content conflicts between branches', async ({ request }) => {
    // Setup: Create a scenario with conflicting changes
    // 1. Create a file on main
    const testFilePath = path.join(testRepo.path, 'conflict-file.txt');
    fs.writeFileSync(testFilePath, 'Original content\n');
    await execAsync('git add conflict-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add conflict-file.txt"', { cwd: testRepo.path });

    // 2. Create a feature branch and modify the file
    await execAsync('git checkout -b feature/test-conflict', { cwd: testRepo.path });
    fs.writeFileSync(testFilePath, 'Feature branch modification\n');
    await execAsync('git add conflict-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Modify file in feature branch"', { cwd: testRepo.path });

    // 3. Go back to main and make a conflicting change
    await execAsync('git checkout main', { cwd: testRepo.path });
    fs.writeFileSync(testFilePath, 'Main branch modification\n');
    await execAsync('git add conflict-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Modify file in main branch"', { cwd: testRepo.path });

    // Call the merge-preview API
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
        sourceBranch: 'feature/test-conflict',
        targetBranch: 'main',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data: MergePreviewResponse = await response.json();

    // Verify conflict detection
    expect(data.success).toBe(true);
    expect(data.hasConflicts).toBe(true);
    expect(data.conflictCount).toBeGreaterThan(0);
    expect(data.conflicts.length).toBeGreaterThan(0);

    // Verify conflict details
    const conflictFile = data.conflicts.find((c) => c.filePath.includes('conflict-file.txt'));
    expect(conflictFile).toBeDefined();
    expect(conflictFile?.conflictType).toBe('content');

    // Verify branch info is returned
    expect(data.sourceBranch).toBe('feature/test-conflict');
    expect(data.targetBranch).toBe('main');
    expect(data.mergeBase).toBeDefined();
  });

  test('should return no conflicts when branches can be cleanly merged', async ({ request }) => {
    // Setup: Create a scenario with non-conflicting changes
    // 1. Create a file on main
    const file1 = path.join(testRepo.path, 'file1.txt');
    fs.writeFileSync(file1, 'File 1 content\n');
    await execAsync('git add file1.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add file1.txt"', { cwd: testRepo.path });

    // 2. Create a feature branch and add a DIFFERENT file
    await execAsync('git checkout -b feature/no-conflict', { cwd: testRepo.path });
    const file2 = path.join(testRepo.path, 'file2.txt');
    fs.writeFileSync(file2, 'File 2 content from feature\n');
    await execAsync('git add file2.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add file2.txt in feature branch"', { cwd: testRepo.path });

    // 3. Go back to main (no changes there)
    await execAsync('git checkout main', { cwd: testRepo.path });

    // Call the merge-preview API
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
        sourceBranch: 'feature/no-conflict',
        targetBranch: 'main',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data: MergePreviewResponse = await response.json();

    // Verify no conflicts
    expect(data.success).toBe(true);
    expect(data.hasConflicts).toBe(false);
    expect(data.conflictCount).toBe(0);
    expect(data.conflicts.length).toBe(0);

    // Verify result tree is returned for clean merge
    expect(data.resultTree).toBeDefined();
    expect(data.sourceBranch).toBe('feature/no-conflict');
    expect(data.targetBranch).toBe('main');
  });

  test('should detect add/add conflicts', async ({ request }) => {
    // Setup: Both branches add the same file with different content
    // 1. Create a feature branch from initial state
    await execAsync('git checkout -b feature/add-add', { cwd: testRepo.path });
    const testFile = path.join(testRepo.path, 'new-file.txt');
    fs.writeFileSync(testFile, 'Content from feature branch\n');
    await execAsync('git add new-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add new-file.txt in feature"', { cwd: testRepo.path });

    // 2. Go back to main and add the same file with different content
    await execAsync('git checkout main', { cwd: testRepo.path });
    fs.writeFileSync(testFile, 'Content from main branch\n');
    await execAsync('git add new-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add new-file.txt in main"', { cwd: testRepo.path });

    // Call the merge-preview API
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
        sourceBranch: 'feature/add-add',
        targetBranch: 'main',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data: MergePreviewResponse = await response.json();

    // Verify conflict detection
    expect(data.success).toBe(true);
    expect(data.hasConflicts).toBe(true);
    expect(data.conflictCount).toBeGreaterThan(0);

    // Verify it's an add/add conflict
    const conflict = data.conflicts.find((c) => c.filePath.includes('new-file.txt'));
    expect(conflict).toBeDefined();
    expect(['add-add', 'content']).toContain(conflict?.conflictType);
  });

  test('should work with featureId parameter', async ({ request }) => {
    // Setup: Create a feature branch using the featureId pattern
    const featureId = 'test-feature-123';
    const branchName = `feature/${featureId}`;

    await execAsync(`git checkout -b "${branchName}"`, { cwd: testRepo.path });
    const testFile = path.join(testRepo.path, 'feature-file.txt');
    fs.writeFileSync(testFile, 'Feature content\n');
    await execAsync('git add feature-file.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Add feature file"', { cwd: testRepo.path });

    // Stay on feature branch - API should detect current branch as target
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
        featureId: featureId,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data: MergePreviewResponse = await response.json();

    expect(data.success).toBe(true);
    expect(data.sourceBranch).toBe(branchName);
  });

  test('should return error for unrelated branches', async ({ request }) => {
    // Create an orphan branch that has no common ancestor
    await execAsync('git checkout --orphan orphan-branch', { cwd: testRepo.path });
    const orphanFile = path.join(testRepo.path, 'orphan.txt');
    fs.writeFileSync(orphanFile, 'Orphan content\n');
    await execAsync('git add orphan.txt', { cwd: testRepo.path });
    await execAsync('git commit -m "Orphan commit"', { cwd: testRepo.path });

    // Call the merge-preview API
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
        sourceBranch: 'main',
        targetBranch: 'orphan-branch',
      },
    });

    // Should return error about unrelated branches
    expect(response.status()).toBe(400);
    const data: MergePreviewResponse = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('merge base');
  });

  test('should validate required parameters', async ({ request }) => {
    // Missing both featureId and branch params
    const response = await request.post(`${API_BASE_URL}/api/worktree/merge-preview`, {
      data: {
        projectPath: testRepo.path,
      },
    });

    expect(response.status()).toBe(400);
    const data: MergePreviewResponse = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('featureId');
  });
});
