# Chapter 88 — Full-Stack Feature Walkthrough: Tasks CRUD

## 📖 What This Chapter Does

Machine-coding rounds and take-home tasks often say *"build a small task manager with login"*. This chapter builds one feature — **Tasks** — through every layer, so you can explain (or code) the whole path in an interview:

```text
shared type → Mongoose model → service → controller → routes
          → RTK Query endpoints → React components
```

Requirements: a logged-in user can list (paginated + filter), create, toggle, edit and delete **their own** tasks. Admins can see everyone's.

## 💻 Step 1 — Shared Types (`packages/shared`)

```ts
// packages/shared/src/types/task.ts
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  done: boolean;
  dueDate: string | null;      // ISO string over the wire — Dates don't survive JSON
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateTaskDto = Pick<TaskDto, "title"> & Partial<Pick<TaskDto, "description" | "priority" | "dueDate">>;
export type UpdateTaskDto = Partial<Omit<TaskDto, "id" | "ownerId" | "createdAt" | "updatedAt">>;

export interface TaskQuery {
  page?: number;
  limit?: number;
  status?: "all" | "open" | "done";
  priority?: TaskPriority;
  search?: string;
}
```

## 💻 Step 2 — Model (`apps/server`)

```ts
// modules/tasks/task.model.ts
import { Schema, model, type Types, type HydratedDocument } from "mongoose";
import { TASK_PRIORITIES, type TaskPriority, type TaskDto } from "@app/shared";

export interface ITask {
  title: string;
  description: string;
  priority: TaskPriority;
  done: boolean;
  dueDate: Date | null;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export type TaskDocument = HydratedDocument<ITask>;

const taskSchema = new Schema<ITask>(
  {
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    priority:    { type: String, enum: TASK_PRIORITIES, default: "medium" },
    done:        { type: Boolean, default: false },
    dueDate:     { type: Date, default: null },
    owner:       { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Matches the main list query: my tasks, filtered by done, newest first (ESR rule: Equality, Sort, Range)
taskSchema.index({ owner: 1, done: 1, createdAt: -1 });
taskSchema.index({ title: "text", description: "text" });

export const Task = model<ITask>("Task", taskSchema);

// Model → DTO mapper: the ONLY place that decides what the client sees
export function toTaskDto(t: ITask & { _id: Types.ObjectId }): TaskDto {
  return {
    id: t._id.toString(),
    title: t.title,
    description: t.description,
    priority: t.priority,
    done: t.done,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    ownerId: t.owner.toString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
```

## 💻 Step 3 — Service

```ts
// modules/tasks/task.service.ts
import type { FilterQuery } from "mongoose";
import type { CreateTaskDto, UpdateTaskDto, TaskQuery, Paginated, TaskDto, Role } from "@app/shared";
import { Task, toTaskDto, type ITask } from "./task.model.js";
import { AppError } from "../../utils/AppError.js";

interface Actor { id: string; role: Role }

// Admins see all; users only their own. Applied to EVERY query → no IDOR bugs.
const scope = (actor: Actor): FilterQuery<ITask> => (actor.role === "admin" ? {} : { owner: actor.id });

export const taskService = {
  async list(actor: Actor, q: TaskQuery): Promise<Paginated<TaskDto>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const filter: FilterQuery<ITask> = { ...scope(actor) };
    if (q.status === "open") filter.done = false;
    if (q.status === "done") filter.done = true;
    if (q.priority) filter.priority = q.priority;
    if (q.search) filter.$text = { $search: q.search };

    const [rows, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Task.countDocuments(filter),
    ]);
    return { items: rows.map(toTaskDto), total, page, limit };
  },

  async create(actor: Actor, dto: CreateTaskDto): Promise<TaskDto> {
    const task = await Task.create({ ...dto, owner: actor.id });
    return toTaskDto(task.toObject());
  },

  async update(actor: Actor, id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const task = await Task.findOneAndUpdate({ _id: id, ...scope(actor) }, dto, {
      new: true,
      runValidators: true,
    }).lean();
    if (!task) throw AppError.notFound("Task");   // 404 (not 403) → don't reveal it exists
    return toTaskDto(task);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    const res = await Task.deleteOne({ _id: id, ...scope(actor) });
    if (res.deletedCount === 0) throw AppError.notFound("Task");
  },
};
```

## 💻 Step 4 — Validators, Controller, Routes

```ts
// modules/tasks/task.validators.ts
import { body, param, query } from "express-validator";
import { TASK_PRIORITIES } from "@app/shared";

export const listRules = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("status").optional().isIn(["all", "open", "done"]),
  query("priority").optional().isIn(TASK_PRIORITIES),
  query("search").optional().trim().isLength({ max: 100 }),
];

export const createRules = [
  body("title").trim().notEmpty().isLength({ max: 200 }),
  body("description").optional().isString().isLength({ max: 5000 }),
  body("priority").optional().isIn(TASK_PRIORITIES),
  body("dueDate").optional({ values: "null" }).isISO8601(),
];

export const updateRules = [
  param("id").isMongoId(),
  body("title").optional().trim().notEmpty().isLength({ max: 200 }),
  body("description").optional().isString(),
  body("priority").optional().isIn(TASK_PRIORITIES),
  body("done").optional().isBoolean().toBoolean(),
  body("dueDate").optional({ values: "null" }).isISO8601(),
];

export const idRules = [param("id").isMongoId()];
```

```ts
// modules/tasks/task.controller.ts
import type { Request, Response } from "express";
import { matchedData } from "express-validator";
import type { ApiResponse, CreateTaskDto, Paginated, TaskDto, TaskQuery, UpdateTaskDto } from "@app/shared";
import { taskService } from "./task.service.js";

// requireAuth runs before these, so req.user is always set
const actor = (req: Request) => req.user!;

export async function list(req: Request, res: Response<ApiResponse<Paginated<TaskDto>>>) {
  const q = matchedData(req, { locations: ["query"] }) as TaskQuery;
  res.json({ success: true, data: await taskService.list(actor(req), q) });
}

export async function create(req: Request, res: Response<ApiResponse<TaskDto>>) {
  const dto = matchedData(req, { locations: ["body"] }) as CreateTaskDto;
  res.status(201).json({ success: true, data: await taskService.create(actor(req), dto) });
}

export async function update(req: Request<{ id: string }>, res: Response<ApiResponse<TaskDto>>) {
  const dto = matchedData(req, { locations: ["body"] }) as UpdateTaskDto;
  res.json({ success: true, data: await taskService.update(actor(req), req.params.id, dto) });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await taskService.remove(actor(req), req.params.id);
  res.status(204).end();
}
```

```ts
// modules/tasks/task.routes.ts
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as v from "./task.validators.js";
import * as c from "./task.controller.js";

export const taskRouter = Router();
taskRouter.use(requireAuth);
taskRouter.get("/", validate(v.listRules), c.list);
taskRouter.post("/", validate(v.createRules), c.create);
taskRouter.patch("/:id", validate(v.updateRules), c.update);
taskRouter.delete("/:id", validate(v.idRules), c.remove);

// app.ts → app.use("/api/tasks", taskRouter);
```

## 🔍 API Contract

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET | `/api/tasks` | `?page&limit&status&priority&search` | `200 { success, data: Paginated<TaskDto> }` |
| POST | `/api/tasks` | `CreateTaskDto` | `201 { success, data: TaskDto }` |
| PATCH | `/api/tasks/:id` | `UpdateTaskDto` | `200 { success, data: TaskDto }` |
| DELETE | `/api/tasks/:id` | — | `204` |
| any | — | invalid input | `400 { success:false, code:"BAD_REQUEST", details }` |
| any | — | not yours / missing | `404` |

## 💻 Step 5 — RTK Query Endpoints (`apps/web`)

```ts
// features/tasks/tasksApi.ts
import { api } from "../../services/api";
import type { ApiResponse, CreateTaskDto, Paginated, TaskDto, TaskQuery, UpdateTaskDto } from "@app/shared";

export const tasksApi = api.injectEndpoints({
  endpoints: (b) => ({
    getTasks: b.query<Paginated<TaskDto>, TaskQuery>({
      query: (params) => ({ url: "/tasks", params }),
      transformResponse: (r: ApiResponse<Paginated<TaskDto>>) => r.data,
      providesTags: (res) => [
        { type: "Task" as const, id: "LIST" },
        ...(res?.items.map((t) => ({ type: "Task" as const, id: t.id })) ?? []),
      ],
    }),

    createTask: b.mutation<TaskDto, CreateTaskDto>({
      query: (body) => ({ url: "/tasks", method: "POST", body }),
      transformResponse: (r: ApiResponse<TaskDto>) => r.data,
      invalidatesTags: [{ type: "Task", id: "LIST" }],
    }),

    updateTask: b.mutation<TaskDto, { id: string; query: TaskQuery } & UpdateTaskDto>({
      query: ({ id, query: _q, ...patch }) => ({ url: `/tasks/${id}`, method: "PATCH", body: patch }),
      transformResponse: (r: ApiResponse<TaskDto>) => r.data,
      // Optimistic update of the list the user is looking at
      async onQueryStarted({ id, query, ...patch }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          tasksApi.util.updateQueryData("getTasks", query, (draft) => {
            const t = draft.items.find((x) => x.id === id);
            if (t) Object.assign(t, patch);
          }),
        );
        queryFulfilled.catch(undo.undo);
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Task", id }],
    }),

    deleteTask: b.mutation<void, string>({
      query: (id) => ({ url: `/tasks/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Task", id: "LIST" }],
    }),
  }),
});

export const { useGetTasksQuery, useCreateTaskMutation, useUpdateTaskMutation, useDeleteTaskMutation } = tasksApi;
```

## 💻 Step 6 — Client UI State in a Slice

The filter is **client state** (what the user is looking at), so it lives in a small slice; the tasks themselves are **server state** in RTK Query.

```ts
// features/tasks/taskFiltersSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TaskQuery } from "@app/shared";

const initialState: Required<Pick<TaskQuery, "page" | "status">> & Pick<TaskQuery, "priority" | "search"> = {
  page: 1,
  status: "all",
};

const taskFiltersSlice = createSlice({
  name: "taskFilters",
  initialState,
  reducers: {
    statusChanged(s, a: PayloadAction<"all" | "open" | "done">) { s.status = a.payload; s.page = 1; },
    searchChanged(s, a: PayloadAction<string>) { s.search = a.payload || undefined; s.page = 1; },
    pageChanged(s, a: PayloadAction<number>) { s.page = a.payload; },
  },
  selectors: { selectTaskQuery: (s) => s },
});

export const { statusChanged, searchChanged, pageChanged } = taskFiltersSlice.actions;
export const { selectTaskQuery } = taskFiltersSlice.selectors;
export default taskFiltersSlice.reducer;
```

## 💻 Step 7 — Components

```tsx
// features/tasks/TasksPage.tsx
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useGetTasksQuery } from "./tasksApi";
import { selectTaskQuery, statusChanged, pageChanged } from "./taskFiltersSlice";
import { NewTaskForm } from "./NewTaskForm";
import { TaskItem } from "./TaskItem";

export function TasksPage() {
  const query = useAppSelector(selectTaskQuery);
  const dispatch = useAppDispatch();
  const { data, isLoading, isFetching, error } = useGetTasksQuery(query);

  const pages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <main>
      <h1>My Tasks</h1>
      <NewTaskForm />

      <div role="tablist">
        {(["all", "open", "done"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={query.status === s} onClick={() => dispatch(statusChanged(s))}>
            {s}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p role="alert">{errorMessage(error)}</p>}

      <ul aria-busy={isFetching}>
        {data?.items.map((t) => <TaskItem key={t.id} task={t} query={query} />)}
      </ul>

      <nav>
        <button disabled={query.page <= 1} onClick={() => dispatch(pageChanged(query.page - 1))}>Prev</button>
        <span>{query.page} / {pages}</span>
        <button disabled={query.page >= pages} onClick={() => dispatch(pageChanged(query.page + 1))}>Next</button>
      </nav>
    </main>
  );
}
```

```tsx
// features/tasks/TaskItem.tsx
import { memo } from "react";
import type { TaskDto, TaskQuery } from "@app/shared";
import { useUpdateTaskMutation, useDeleteTaskMutation } from "./tasksApi";

export const TaskItem = memo(function TaskItem({ task, query }: { task: TaskDto; query: TaskQuery }) {
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();

  return (
    <li className={task.done ? "done" : undefined}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => updateTask({ id: task.id, query, done: !task.done })}
        aria-label={`Mark ${task.title} as ${task.done ? "open" : "done"}`}
      />
      <span>{task.title}</span>
      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
      {task.dueDate && <time dateTime={task.dueDate}>{new Date(task.dueDate).toLocaleDateString()}</time>}
      <button disabled={deleting} onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>🗑</button>
    </li>
  );
});
```

```tsx
// features/tasks/NewTaskForm.tsx
import { useState } from "react";
import { TASK_PRIORITIES, type TaskPriority } from "@app/shared";
import { useCreateTaskMutation } from "./tasksApi";

export function NewTaskForm() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [createTask, { isLoading }] = useCreateTaskMutation();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ title: title.trim(), priority }).unwrap();
    setTitle("");
  }

  return (
    <form onSubmit={onSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={200} />
      <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
        {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <button disabled={isLoading}>Add</button>
    </form>
  );
}
```

## 🔍 How a Single Click Flows Through the Stack

```text
Checkbox click
 → updateTask({ id, query, done: true })                       RTK Query mutation
 → onQueryStarted patches cached list → UI updates instantly    optimistic
 → PATCH /api/tasks/:id  Authorization: Bearer …               baseQueryWithReauth
 → requireAuth → validate(updateRules) → controller
 → taskService.update → findOneAndUpdate({ _id, owner })       ownership enforced in DB query
 → 200 TaskDto → invalidatesTags Task:id → list refetches       confirms server truth
 (on failure → undo patch → error toast via middleware)
```

## 🌍 Real-World Impact

- Scoping **every** query by `owner` in the service (not the controller) prevents IDOR — the #1 API vulnerability (OWASP API1).
- A single `toTaskDto` mapper guarantees the API shape matches the shared type and never leaks internal fields.
- Splitting client state (filters slice) from server state (RTK Query cache) keeps both simple.

## 🎯 Likely Interview Questions

1. **Walk me through what happens when a user marks a task done.** — Use the flow above.
2. **How do you stop user A from editing user B's task?** — Include `owner: req.user.id` in the DB filter; return 404.
3. **Why convert Mongoose documents to DTOs?** — Control the public shape, convert ObjectId/Date to strings, never leak secrets.
4. **Why are dates strings in the shared type?** — JSON has no Date type; send ISO strings and parse on the client.
5. **Which index would you add for the list query?** — Compound `{ owner: 1, done: 1, createdAt: -1 }` (ESR rule).
6. **Where does the filter state live and why?** — Redux slice (client state); fetched tasks in RTK Query (server state).
7. **How does the list update after creating a task?** — `invalidatesTags: [Task:LIST]` triggers a refetch of list queries.
8. **How would you add real-time updates?** — Socket.IO event on change → `api.util.invalidateTags` or `updateQueryData` in a listener.

---

[← React with TypeScript](06-react-with-typescript.md) | [Index](../README.md) | [Next: Testing MERN + TypeScript →](08-testing-mern-typescript.md)
