/**
 * Undo/redo behaviour (v0.25.0).
 *
 * These drive the store directly rather than the UI, because what is under
 * test is the history model itself: that undo restores structure, that it
 * never rolls back prose written since, that one gesture costs one step,
 * and that Ctrl+Z routes to the right one of the app's two undo stacks.
 *
 * The two cases that guard real bugs were each verified to FAIL on a
 * deliberately broken build before being trusted — neutering
 * mergeLiveProse made "keeps prose written after the undone action" report
 * the old text, and disabling the mergeKey window made "typing a name is
 * ONE undo step" undo one letter at a time. A test that has never been
 * seen to fail is a test that proves nothing.
 *
 * Note where steps are split across separate `api()` calls: a single
 * synchronous burst is deliberately treated as ONE gesture by the
 * coalescing rule, so tests about separate gestures must actually be
 * separate tasks.
 */
export default async function ({ api, check }) {
  let r;

  // 1 — delete then undo restores the scene
  r = await api(() => {
    const s = window.__scriareProjectStore;
    s.getState().deleteScene('s2');
    const afterDelete = s.getState().project.scenes.map(x => x.id);
    const label = s.getState().undoLabel;
    s.getState().undo();
    const afterUndo = s.getState().project.scenes.map(x => x.id);
    return { afterDelete, afterUndo, label, canRedo: s.getState().canRedo };
  });
  check('delete → undo restores the scene', r.afterDelete.join() === 's1,s3' && r.afterUndo.join() === 's1,s2,s3',
    `after delete [${r.afterDelete}] → after undo [${r.afterUndo}], label "${r.label}"`);
  check('undo populates the redo stack', r.canRedo === true);

  // 2 — redo puts it back
  r = await api(() => {
    const s = window.__scriareProjectStore;
    s.getState().redo();
    const ids = s.getState().project.scenes.map(x => x.id);
    s.getState().undo(); // return to the full set for later tests
    return ids;
  });
  check('redo re-applies the delete', r.join() === 's1,s3', `[${r}]`);

  // 3 — THE DATA-LOSS TEST: prose written after a structural change survives undo
  r = await api(() => {
    const s = window.__scriareProjectStore;
    s.getState().deleteScene('s2');
    s.getState().updateSceneContent('s3', {
      type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PRECIOUS NEW WORDS' }] }],
    });
    s.getState().undo();
    const p = s.getState().project;
    const three = p.scenes.find(x => x.id === 's3');
    const two = p.scenes.find(x => x.id === 's2');
    return {
      s3text: three?.content?.content?.[0]?.content?.[0]?.text,
      s2text: two?.content?.content?.[0]?.content?.[0]?.text,
      s2back: Boolean(two),
    };
  });
  check('undo keeps prose written after the undone action', r.s3text === 'PRECIOUS NEW WORDS', `s3 reads "${r.s3text}"`);
  check('undo restores a deleted scene WITH its own prose', r.s2back && r.s2text === 'two', `s2 reads "${r.s2text}"`);

  // 4 — keystroke coalescing: typing a frame title is one undo step
  // Every keystroke is its own evaluate(), so each lands in a separate task
  // — exactly like real typing, and NOT coalescable by the same-task rule.
  // Only the mergeKey window can fold these together, which is the point.
  {
    const before = await api(() => window.__scriareProjectStore.getState().project.frames[0].title);
    for (const t of ['C','Ch','Cha','Chap','Chapt','Chapte','Chapter']) {
      await api((title) => window.__scriareProjectStore.getState().renameFrame('f1', title), t);
    }
    const typed = await api(() => window.__scriareProjectStore.getState().project.frames[0].title);
    await api(() => window.__scriareProjectStore.getState().undo());
    r = { before, typed, afterOneUndo: await api(() => window.__scriareProjectStore.getState().project.frames[0].title) };
  }
  check('typing a name is ONE undo step', r.afterOneUndo === r.before,
    `"${r.before}" → typed "${r.typed}" → one undo gave "${r.afterOneUndo}"`);

  // 5 — synchronous burst coalescing: a multi-select graph drag is one step
  r = await api(() => {
    const s = window.__scriareProjectStore;
    const before = s.getState().project.scenes.map(x => `${x.position.x},${x.position.y}`).join(' | ');
    // exactly what FlowPanel's onNodeDragStop does for a 3-node selection
    s.getState().updateScenePosition('s1', { x: 100, y: 100 });
    s.getState().updateScenePosition('s2', { x: 200, y: 100 });
    s.getState().updateScenePosition('s3', { x: 300, y: 100 });
    const moved = s.getState().project.scenes.map(x => `${x.position.x},${x.position.y}`).join(' | ');
    s.getState().undo();
    return { before, moved, after: s.getState().project.scenes.map(x => `${x.position.x},${x.position.y}`).join(' | ') };
  });
  check('a multi-node move is ONE undo step', r.after === r.before, `moved [${r.moved}] → one undo gave [${r.after}]`);

  // 6 — a new action clears the redo branch.
  // Each step is its own evaluate() so it lands in its own task, the way
  // separate user gestures do — a single synchronous burst is deliberately
  // treated as ONE gesture by the coalescing rule (test 5), so running these
  // together would be testing the wrong thing.
  await api(() => window.__scriareProjectStore.getState().renameScene('s1', 'Renamed'));
  await api(() => window.__scriareProjectStore.getState().undo());
  const redoAvailable = await api(() => window.__scriareProjectStore.getState().canRedo);
  await api(() => window.__scriareProjectStore.getState().createFolder(null));
  r = { redoAvailable, afterNewAction: await api(() => window.__scriareProjectStore.getState().canRedo) };
  check('a new action clears the redo branch', r.redoAvailable === true && r.afterNewAction === false);

  // 7 — Play Mode is sealed off
  r = await api(() => {
    const s = window.__scriareProjectStore;
    const before = s.getState().project.content.length;
    s.setState({ isPlaying: true });
    s.getState().undo();
    const during = s.getState().project.content.length;
    s.setState({ isPlaying: false });
    return { before, during };
  });
  check('undo is inert during Play Mode', r.before === r.during, `${r.before} → ${r.during} content nodes`);

  // 8 — history is bounded and never grows past the limit
  // Each createFolder gets its own task (await yields to the microtask
  // queue between them), so these count as 120 separate gestures.
  for (let i = 0; i < 120; i++) {
    await api(() => window.__scriareProjectStore.getState().createFolder(null));
  }
  r = 0;
  // eslint-disable-next-line no-constant-condition
  while (await api(() => window.__scriareProjectStore.getState().canUndo) && r < 400) {
    await api(() => window.__scriareProjectStore.getState().undo());
    r++;
  }
  check('history is capped at 50 steps', r <= 50 && r >= 45, `unwound ${r} steps`);

  // 9 — closing the project wipes history
  r = await api(() => {
    const s = window.__scriareProjectStore;
    s.setState({ project: { name:'x', createdAt:'', updatedAt:'', scenes:[{id:'a',title:'a',content:{type:'doc',content:[]},position:{x:0,y:0},frameId:null,order:0}], content:[], frames:[], favorites:[], variables:[], startSceneId:'a' } });
    s.getState().createFolder(null);
    const had = s.getState().canUndo;
    s.getState().closeProject();
    return { had, after: s.getState().canUndo };
  });
  check('closing a project wipes its history', r.had === true && r.after === false);

  // 10 — the keyboard seam: Ctrl+Z inside a text field / the editor belongs to
  // that field's own undo and must never reach through to project history.
  await api(() => {
    const s = window.__scriareProjectStore;
    s.setState({ project: { name:'k', createdAt:'', updatedAt:'', scenes:[{id:'a',title:'a',content:{type:'doc',content:[]},position:{x:0,y:0},frameId:null,order:0}], content:[], frames:[], favorites:[], variables:[], startSceneId:'a' }, selectedSceneId:'a', isPlaying:false });
  });
  await api(() => window.__scriareProjectStore.getState().createFolder(null));
  await api(() => window.__scriareProjectStore.getState().createFolder(null));

  r = await api(() => {
    const s = window.__scriareProjectStore;
    const fire = (el) => el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
    }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const before = s.getState().project.content.length;
    fire(input);
    const afterInput = s.getState().project.content.length;
    input.remove();

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    editable.focus();
    fire(editable);
    const afterEditable = s.getState().project.content.length;
    editable.remove();

    fire(document.body);
    const afterBody = s.getState().project.content.length;
    return { before, afterInput, afterEditable, afterBody };
  });
  check('Ctrl+Z in a text input does NOT undo the project',
    r.afterInput === r.before, `${r.before} → ${r.afterInput} folders`);
  check('Ctrl+Z in the editor (contenteditable) does NOT undo the project',
    r.afterEditable === r.before, `${r.before} → ${r.afterEditable} folders`);
  check('Ctrl+Z outside any text field DOES undo the project',
    r.afterBody === r.before - 1, `${r.before} → ${r.afterBody} folders`);
}
