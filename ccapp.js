import React, { useEffect, useMemo, useRef, useState } from "react";

// Intentionally BUGGY credit card utilization app
// Notes: This file intentionally contains logic, state, and UX bugs for practice.
// ⚠️ Do NOT use this in production.

export default function BuggyCreditUtilizationApp() {
  const [cards, setCards] = useState([
    { id: 1, name: "Everyday", limit: 5000, balance: 1200 },
    { id: 2, name: "Travel", limit: 12000, balance: 4000 },
  ]);
  const [newCard, setNewCard] = useState({ name: "", limit: "", balance: "" });
  const [goal, setGoal] = useState(29); // target utilization %
  const idCounter = useRef(3);

  // --- BUG: Wrong formula for total utilization (uses average of per-card percentages instead of total balance / total limit) ---
  const utilization = useMemo(() => {
    if (!cards.length) return 0;
    // BUG: per-card average skews the result vs. overall utilization
    const avg =
      cards.reduce((sum, c) => sum + ((Number(c.balance) || 0) / (Number(c.limit) || 1)) * 100, 0) /
      cards.length;
    // BUG: rounds down aggressively, hiding risk just below thresholds
    return Math.floor(avg);
  }, [cards]);

  // --- BUG: Derived totals mis-handle NaN/empty values and allow negatives ---
  const totals = useMemo(() => {
    const totalLimit = cards.reduce((s, c) => s + Number(c.limit), 0); // BUG: Number("") => 0 is fine, but Number(" ") => 0; negatives allowed
    const totalBalance = cards.reduce((s, c) => s + Number(c.balance), 0);
    return { totalLimit, totalBalance };
  }, [cards]);

  // --- BUG: Persist to localStorage with stale snapshot (missing dependency) and fragile parse ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cards");
      if (raw) {
        // BUG: no schema validation; any shape will set state
        setCards(JSON.parse(raw));
      }
    } catch (e) {
      // swallow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // BUG: forgets to include `cards` in deps sometimes; also persists even when invalid values present
    try {
      localStorage.setItem("cards", JSON.stringify(cards));
    } catch {}
  }, [cards, goal]); // BUG: `goal` doesn't affect stored data

  // --- BUG: Mutates state item directly then sets, causing React to skip updates sometimes ---
  const updateCard = (id, patch) => {
    const next = cards.map((c) => {
      if (c.id === id) {
        Object.assign(c, patch); // BUG: direct mutation
      }
      return c;
    });
    setCards(next);
  };

  // --- BUG: Allows adding invalid rows (empty name, NaN, negatives, very large) ---
  const addCard = () => {
    const id = idCounter.current++;
    setCards([
      ...cards,
      {
        id,
        name: newCard.name || `Card ${id}`,
        limit: parseFloat(newCard.limit), // BUG: NaN allowed
        balance: parseFloat(newCard.balance), // BUG: NaN allowed
      },
    ]);
    setNewCard({ name: "", limit: "", balance: "" });
  };

  // --- BUG: Removes using array index assumption (can delete wrong item if list reorders) ---
  const removeCard = (id) => {
    const idx = cards.findIndex((c) => c.id === id);
    cards.splice(idx, 1); // BUG: mutates array in place
    setCards(cards); // BUG: setting same ref
  };

  // --- BUG: Suggestion calculation uses wrong target math and divides by zero when totalBalance is 0 ---
  const payoffToGoal = useMemo(() => {
    const { totalLimit, totalBalance } = totals;
    // Intended: want x so that (totalBalance - x) / totalLimit * 100 <= goal
    // BUG: swaps limit/balance and incorrect isolation of x
    const needed = Math.max(0, Math.ceil(totalLimit - (goal / 100) * totalBalance));
    return isFinite(needed) ? needed : 0; // BUG: hides NaN/Infinity silently
  }, [totals, goal]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Credit Card Utilization (BUGGY)</h1>
          <p className="text-sm text-slate-600 mt-1">
            This demo intentionally contains mistakes in math, state management, and UX. Use it to practice debugging.
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl shadow p-4 bg-white">
            <div className="text-xs uppercase text-slate-500">Overall Utilization</div>
            <div className="text-4xl font-semibold" aria-live="polite">{utilization}%</div>
            {/* BUG: color never turns red for high utilization due to wrong threshold */}
            <div className={`mt-2 text-sm ${utilization < 10 ? "text-green-600" : "text-amber-600"}`}>
              {utilization < 10 ? "Looks great" : "Could be better"}
            </div>
          </div>

          <div className="rounded-2xl shadow p-4 bg-white">
            <div className="text-xs uppercase text-slate-500">Totals</div>
            <div className="mt-1">
              <div className="text-sm">Total Limit: ${totals.totalLimit}</div>
              <div className="text-sm">Total Balance: ${totals.totalBalance}</div>
            </div>
          </div>

          <div className="rounded-2xl shadow p-4 bg-white">
            <label className="text-xs uppercase text-slate-500">Target Utilization</label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="range"
                min="1"
                max="90"
                value={goal}
                onChange={(e) => setGoal(parseInt(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                className="w-20 border rounded px-2 py-1"
                value={goal}
                onChange={(e) => setGoal(e.target.value)} // BUG: stores string sometimes
              />
            </div>
            <div className="text-sm mt-2">Suggested payoff to hit goal: ${payoffToGoal}</div>
          </div>
        </section>

        <section className="rounded-2xl shadow bg-white overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Cards</h2>
            <button
              onClick={() => {
                // BUG: async set followed by read (race conditions not visible here but pattern is poor)
                setCards([]);
                const last = cards[cards.length - 1];
                if (last) alert(`Last card was ${last.name}`); // may alert wrong thing
              }}
              className="text-xs px-3 py-1 rounded-full border hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 text-sm">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Limit</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Util%</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c, i) => (
                // BUG: uses array index as key which breaks state during reordering/removal
                <tr key={i} className="border-t hover:bg-slate-50/60">
                  <td className="p-3">
                    <input
                      className="border rounded px-2 py-1 w-40"
                      value={c.name}
                      onChange={(e) => updateCard(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-32"
                      value={c.limit}
                      onChange={(e) => updateCard(c.id, { limit: e.target.value })} // BUG: stores string, allows negatives
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-32"
                      value={c.balance}
                      onChange={(e) => updateCard(c.id, { balance: e.target.value })} // BUG: stores string
                    />
                  </td>
                  <td className="p-3 text-slate-700">
                    {/* BUG: per-row utilization divides by (limit || 1) which hides zero-limit errors */}
                    {Math.round(((Number(c.balance) || 0) / (Number(c.limit) || 1)) * 100)}%
                  </td>
                  <td className="p-3">
                    <button className="text-red-600 text-sm" onClick={() => removeCard(c.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              <tr className="border-t bg-slate-50/50">
                <td className="p-3">
                  <input
                    placeholder="e.g., Groceries"
                    className="border rounded px-2 py-1 w-40"
                    value={newCard.name}
                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    placeholder="5000"
                    className="border rounded px-2 py-1 w-32"
                    value={newCard.limit}
                    onChange={(e) => setNewCard({ ...newCard, limit: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    placeholder="1200"
                    className="border rounded px-2 py-1 w-32"
                    value={newCard.balance}
                    onChange={(e) => setNewCard({ ...newCard, balance: e.target.value })}
                  />
                </td>
                <td className="p-3 text-slate-700">—</td>
                <td className="p-3">
                  <button className="text-sm px-3 py-1 rounded-full border" onClick={addCard}>
                    Add Card
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="text-xs text-slate-500 mt-6">
          Known issues (on purpose): wrong overall utilization math, unsafe state mutations, fragile storage, missing validation,
          incorrect payoff suggestion, inconsistent types, weak accessibility, and more.
        </footer>
      </div>
    </div>
  );
}
