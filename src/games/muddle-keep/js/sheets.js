/* ------------------------------------------------------------------ *
 * Sheets
 * The little bottom panels for choosing rooms, traps and creatures.
 * They read from the running game and call back into the UI so the
 * tool belt and hints stay in sync.
 * ------------------------------------------------------------------ */

export function openSheet(ui, title, note, items) {
  const el = ui.el;
  el['sheet-title'].textContent = title;
  el['sheet-note'].textContent = note ?? '';
  const grid = el['sheet-grid'];
  grid.replaceChildren();
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mk-sheet-item';
    button.disabled = Boolean(item.disabled);
    button.innerHTML = `
      <span class="mk-sheet-icon" aria-hidden="true">${item.icon ?? '•'}</span>
      <span class="mk-sheet-body">
        <strong>${item.name}</strong>
        ${item.meta ? `<span class="mk-sheet-meta">${item.meta}</span>` : ''}
        ${item.desc ? `<span class="mk-sheet-desc">${item.desc}</span>` : ''}
      </span>
    `;
    button.addEventListener('click', () => {
      item.onPick?.();
      closeSheet(ui);
    });
    grid.append(button);
  }
  el.sheet.hidden = false;
}

export function closeSheet(ui) {
  ui.el.sheet.hidden = true;
}

export function openRoomSheet(ui) {
  if (!ui.game) return;
  const gold = ui.game.economy.gold;
  const items = ui.content.rooms
    .filter((room) => ui.game.economy.rooms.has(room.id))
    .map((room) => ({
      icon: room.icon,
      name: room.name,
      meta: `${room.cost} gold a tile · needs ${room.minTiles}`,
      desc: room.desc,
      disabled: gold < room.cost,
      onPick: () => {
        ui.selection = { room: room.id, trap: null };
        ui.updateToolLabels();
        ui.setActiveTool('room');
        ui.game.setTool({ type: 'room', id: room.id });
      },
    }));
  openSheet(ui, 'Rooms', 'Rooms only work once they reach their minimum size.', items);
}

export function openTrapSheet(ui) {
  if (!ui.game) return;
  const hasWorkshop = ui.game.world.hasRoom('workshop');
  const items = ui.content.traps
    .filter((trap) => ui.game.economy.traps.has(trap.id))
    .map((trap) => ({
      icon: trap.icon,
      name: trap.name,
      meta: `${trap.cost} gold${trap.damage ? ` · ${trap.damage} damage` : ''}`,
      desc: trap.desc,
      disabled: !hasWorkshop,
      onPick: () => {
        ui.selection = { room: null, trap: trap.id };
        ui.updateToolLabels();
        ui.setActiveTool('trap');
        ui.game.setTool({ type: 'trap', id: trap.id });
      },
    }));
  openSheet(
    ui,
    'Traps & doors',
    hasWorkshop
      ? 'Your creatures know where the bouncy bits are.'
      : 'Build a Workshop to place these.',
    items.length
      ? items
      : [
          {
            icon: '🔨',
            name: 'Nothing yet',
            desc: 'Build a Workshop, then research traps in the Library.',
          },
        ]
  );
}

export function openCreatureSheet(ui) {
  if (!ui.game) return;
  const game = ui.game;
  const items = game.creatures.list.map((creature) => ({
    icon: creature.def.icon ?? '👾',
    name: `${creature.def.name} · Lv ${creature.level}`,
    meta: `HP ${Math.ceil(creature.hp)}/${creature.maxHp} · Mood ${Math.round(
      creature.mood
    )} · ${creature.def.role}`,
    desc: `Hunger ${Math.round(creature.hunger)} · Energy ${Math.round(
      creature.energy
    )} · Wage ${creature.def.wage}/min · ${creature.state}`,
    onPick: () => {
      ui.options.onFocus?.(creature);
    },
  }));
  openSheet(
    ui,
    `Creatures (${items.length}/${game.creatures.cap()})`,
    'Wages are paid every minute. Mood drops when creatures are hungry, tired or unpaid.',
    items.length
      ? items
      : [{ icon: '🕳️', name: 'No creatures yet', desc: 'A Portal will attract some.' }]
  );
}
