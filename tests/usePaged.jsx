import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { usePaged } from "/src/lib/usePaged.ts";

window.IS_REACT_ACT_ENVIRONMENT = true;

let current;
const requests = [];
const fetcher = (search, limit, offset) =>
  new Promise((resolve, reject) => {
    requests.push({ search, limit, offset, resolve, reject });
  });

function Harness({ version }) {
  current = usePaged(fetcher, version);
  return null;
}

const root = createRoot(document.getElementById("root"));
const results = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(condition, message) {
  if (!condition) throw new Error(message);
  results.push(`PASS: ${message}`);
}

try {
  await act(async () => {
    root.render(<React.StrictMode><Harness version={0} /></React.StrictMode>);
  });
  await act(async () => { await delay(300); });
  await act(async () => {
    for (const request of requests) request.resolve(["initial"]);
  });
  check(
    current.rows[0] === "initial" && !current.loading,
    "Initial load works in React StrictMode",
  );

  await act(async () => { current.setOffset(100); });
  let pageRequest;
  await act(async () => { pageRequest = current.reload("", 100); });
  const pending = requests.at(-1);
  await act(async () => { current.setSearch("new"); });
  await act(async () => {
    pending.resolve(["stale"]);
    await pageRequest;
  });
  check(
    current.rows[0] !== "stale",
    "Old page response is ignored during search debounce",
  );

  await act(async () => { await delay(300); });
  const searchRequest = requests.at(-1);
  check(
    searchRequest.search === "new" && searchRequest.offset === 0,
    "Search resets pagination to the first page",
  );
  await act(async () => {
    searchRequest.resolve(Array.from({ length: 101 }, (_, i) => `result ${i}`));
  });
  check(
    current.rows.length === 100 && current.hasMore && current.offset === 0,
    "Pagination keeps 100 rows and detects another page",
  );

  await act(async () => {
    root.render(<React.StrictMode><Harness version={1} /></React.StrictMode>);
  });
  const refreshRequest = requests.at(-1);
  await act(async () => { refreshRequest.resolve([]); });
  check(
    current.rows.length === 0 && !current.hasMore,
    "Database version refresh clears deleted rows",
  );
  await act(async () => { root.unmount(); });
  document.getElementById("results").textContent =
    results.join("\n") + "\nALL 5 CHECKS PASSED";
} catch (error) {
  document.getElementById("results").textContent =
    results.join("\n") + "\nFAIL: " + error;
  console.error(error);
}
