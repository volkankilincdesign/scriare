/**
 * Undo toasts (v0.26.0).
 *
 * The delete confirmations were removed in favour of these, so the toast
 * IS the safety net now — which makes one case load-bearing above all the
 * others: a toast must never reverse an action other than the one it is
 * about. Delete a scene, drag two nodes in the graph, then click the
 * toast's Undo: a naive implementation undoes the drag and leaves the
 * scene deleted, which is strictly worse than offering no button at all.
 *
 * That case ("goes stale…") was verified to FAIL on a build with the
 * staleness check removed, where clicking through after an unrelated
 * action undid the wrong thing.
 */
export default async function ({ api, check, seedProject }) {
  // 1 — deleting raises a toast that offers to undo
  let r = await api(() => {
    const project = window.__scriareProjectStore;
    const toasts = window.__scriareToastStore;
    toasts.setState({ toasts: [] });

    project.getState().deleteScene("s2");
    toasts.getState().showUndo('Deleted "Two"');

    const t = toasts.getState().toasts;
    return {
      count: t.length,
      message: t[0]?.message,
      stale: t[0]?.stale,
      matchesTop: t[0]?.undoToken === project.getState().undoToken,
      scenes: project.getState().project.scenes.map((x) => x.id),
    };
  });
  check("a delete raises one toast with a live undo", r.count === 1 && r.stale === false && r.matchesTop,
    `"${r.message}", scenes now [${r.scenes}]`);

  // 2 — clicking Undo reverses that action
  r = await api(() => {
    const project = window.__scriareProjectStore;
    const toasts = window.__scriareToastStore;
    const id = toasts.getState().toasts[0].id;
    toasts.getState().undoToast(id);
    return {
      scenes: project.getState().project.scenes.map((x) => x.id),
      remaining: toasts.getState().toasts.length,
    };
  });
  check("clicking Undo restores the deleted scene", r.scenes.join() === "s1,s2,s3", `[${r.scenes}]`);
  check("acting on a toast dismisses it", r.remaining === 0);

  // 3 — THE ONE THAT MATTERS: a toast goes stale once something else happens,
  // and refuses to undo the wrong action.
  await seedProject();
  await api(() => {
    const project = window.__scriareProjectStore;
    const toasts = window.__scriareToastStore;
    toasts.setState({ toasts: [] });
    project.getState().deleteScene("s2");
    toasts.getState().showUndo('Deleted "Two"');
  });
  // A separate task, so this is a genuinely separate gesture.
  await api(() => window.__scriareProjectStore.getState().renameScene("s1", "Renamed Later"));

  r = await api(() => {
    const project = window.__scriareProjectStore;
    const toasts = window.__scriareToastStore;
    const toast = toasts.getState().toasts[0];
    const staleBefore = toast?.stale;
    toasts.getState().undoToast(toast.id);
    const p = project.getState().project;
    return {
      staleBefore,
      title: p.scenes.find((x) => x.id === "s1")?.title,
      scenes: p.scenes.map((x) => x.id),
    };
  });
  check("a toast goes stale once another action happens", r.staleBefore === true);
  check("a stale toast does NOT undo the wrong action",
    r.title === "Renamed Later" && r.scenes.join() === "s1,s3",
    `s1 is "${r.title}", scenes [${r.scenes}] (the rename survived, the delete stayed undone-nothing)`);

  // 4 — undoing by another route (keyboard, top bar) also retires the toast
  await seedProject();
  r = await api(() => {
    const project = window.__scriareProjectStore;
    const toasts = window.__scriareToastStore;
    toasts.setState({ toasts: [] });
    project.getState().deleteScene("s2");
    toasts.getState().showUndo('Deleted "Two"');
    project.getState().undo(); // as if the writer pressed Ctrl+Z instead
    return {
      stale: toasts.getState().toasts[0]?.stale,
      scenes: project.getState().project.scenes.map((x) => x.id),
    };
  });
  check("undoing by keyboard retires the toast's button",
    r.stale === true && r.scenes.join() === "s1,s2,s3", `[${r.scenes}]`);

  // 5 — a plain notice with no undo token offers no action
  r = await api(() => {
    const toasts = window.__scriareToastStore;
    toasts.setState({ toasts: [{ id: 9999, message: "Just saying", undoToken: null, stale: false }] });
    toasts.getState().undoToast(9999);
    return toasts.getState().toasts.length;
  });
  check("a toast with no undo token is inert but dismissable", r === 0);

  await seedProject();
}
