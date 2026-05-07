import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from './_helpers';

describe('projects CRUD', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('creates, lists, updates, deletes a project', async () => {
    const u = await createTestUser('alice');
    const headers = {
      cookie: u.cookies,
      'X-CSRF-Token': u.csrfToken,
      'content-type': 'application/json',
    };
    const create = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'My Project' }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { project: { id: string; name: string } };
    const id = created.project.id;

    const list = await SELF.fetch('http://localhost/projects/', {
      headers: { cookie: u.cookies },
    });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { projects: Array<{ id: string }> };
    expect(listed.projects.find((p) => p.id === id)).toBeTruthy();

    const patch = await SELF.fetch(`http://localhost/projects/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(patch.status).toBe(200);

    const del = await SELF.fetch(`http://localhost/projects/${id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(200);
  });

  it('default 3 columns are created with project', async () => {
    const u = await createTestUser('with-cols');
    const headers = {
      cookie: u.cookies,
      'X-CSRF-Token': u.csrfToken,
      'content-type': 'application/json',
    };
    const create = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Boards' }),
    });
    const created = (await create.json()) as { project: { id: string } };
    const id = created.project.id;
    const cols = await SELF.fetch(`http://localhost/projects/${id}/columns`, {
      headers: { cookie: u.cookies },
    });
    expect(cols.status).toBe(200);
    const body = (await cols.json()) as { columns: Array<{ name: string }> };
    expect(body.columns.map((c) => c.name)).toEqual(['Todo', 'In Progress', 'Done']);
  });
});
