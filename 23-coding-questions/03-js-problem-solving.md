# Chapter 95 — JS Problem Solving

## 📖 Definition

These are the **practical JavaScript coding problems** asked in MERN interviews — not hard algorithm puzzles, but everyday data manipulation: grouping, flattening, de-duplicating, string handling, and small data structures like an LRU cache. Interviewers watch for clean use of `Map`/`Set`, array methods, and edge cases.

Every block is runnable; the expected output is in the comments. Try each one yourself first.

## 🧠 Approach

1. Clarify input and output with an example.
2. Say the brute-force idea, then the better one, with time complexity.
3. Code it with clear names; handle empty input.
4. Run through one example by hand.

## 🔤 Strings

### 1. Reverse a String and Check a Palindrome

```js
const reverse = (s) => [...s].reverse().join("");          // spread handles emoji/unicode correctly

function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let i = 0, j = clean.length - 1;
  while (i < j) if (clean[i++] !== clean[j--]) return false;
  return true;
}

console.log(reverse("hello"));                             // olleh
console.log(isPalindrome("A man, a plan, a canal: Panama")); // true
console.log(isPalindrome("react"));                        // false
```

### 2. Character Frequency and First Non-Repeating Character

```js
function charCount(s) {
  const map = new Map();
  for (const ch of s) map.set(ch, (map.get(ch) ?? 0) + 1);
  return map;
}

function firstUnique(s) {
  const counts = charCount(s);
  for (const ch of s) if (counts.get(ch) === 1) return ch;
  return null;
}

console.log(Object.fromEntries(charCount("banana"))); // { b: 1, a: 3, n: 2 }
console.log(firstUnique("swiss"));                     // w
```

### 3. Anagrams — Check and Group

```js
const isAnagram = (a, b) => a.length === b.length && [...a].sort().join("") === [...b].sort().join("");

function groupAnagrams(words) {
  const groups = new Map();
  for (const w of words) {
    const key = [...w].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return [...groups.values()];
}

console.log(isAnagram("listen", "silent"));                         // true
console.log(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));
// [["eat","tea","ate"], ["tan","nat"], ["bat"]]
```

### 4. Capitalise Words, camelCase and snake_case

```js
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const toCamel = (s) => s.toLowerCase().replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase());
const toSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();

console.log(titleCase("hello WORLD from js"));   // Hello World From Js
console.log(toCamel("user_first-name"));         // userFirstName
console.log(toSnake("userFirstName"));           // user_first_name
```

### 5. Longest Substring Without Repeating Characters (Sliding Window)

```js
function longestUnique(s) {
  const lastSeen = new Map();
  let start = 0, best = 0;
  for (let i = 0; i < s.length; i++) {
    if (lastSeen.has(s[i]) && lastSeen.get(s[i]) >= start) start = lastSeen.get(s[i]) + 1;
    lastSeen.set(s[i], i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}

console.log(longestUnique("abcabcbb")); // 3 ("abc")
console.log(longestUnique("pwwkew"));   // 3 ("wke")
```

### 6. Compress a String (`aaabcc` → `a3b1c2`)

```js
function compress(s) {
  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += s[i] + (j - i);
    i = j;
  }
  return out;
}

console.log(compress("aaabcc")); // a3b1c2
```

## 🧮 Arrays

### 7. Remove Duplicates (Primitives and Objects)

```js
const uniq = (arr) => [...new Set(arr)];

function uniqBy(arr, key) {
  const seen = new Set();
  return arr.filter((item) => {
    const k = typeof key === "function" ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

console.log(uniq([1, 2, 2, 3, 1]));                                    // [1, 2, 3]
console.log(uniqBy([{ id: 1, n: "a" }, { id: 1, n: "b" }, { id: 2, n: "c" }], "id"));
// [{ id: 1, n: "a" }, { id: 2, n: "c" }]
```

### 8. Group By and Count By

```js
const orders = [
  { id: 1, status: "paid", amount: 500 },
  { id: 2, status: "pending", amount: 200 },
  { id: 3, status: "paid", amount: 300 },
];

const groupBy = (arr, fn) =>
  arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

console.log(Object.keys(groupBy(orders, (o) => o.status)));   // ["paid", "pending"]

// ES2024 built-in
console.log(Object.groupBy(orders, (o) => o.status).paid.length); // 2

// Sum per group
const totals = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + o.amount }), {});
console.log(totals);                                          // { paid: 800, pending: 200 }
```

### 9. Two Sum (Hash Map)

```js
function twoSum(nums, target) {
  const seen = new Map();                      // value → index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]   — O(n) instead of O(n²)
```

### 10. Chunk an Array and Find the Intersection

```js
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

const intersection = (a, b) => {
  const setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
};

console.log(chunk([1, 2, 3, 4, 5], 2));            // [[1, 2], [3, 4], [5]]
console.log(intersection([1, 2, 2, 3], [2, 3, 4])); // [2, 3]
```

### 11. Move Zeros to the End (In Place) and Rotate an Array

```js
function moveZeros(nums) {
  let insert = 0;
  for (const n of nums) if (n !== 0) nums[insert++] = n;
  while (insert < nums.length) nums[insert++] = 0;
  return nums;
}

const rotateRight = (arr, k) => {
  k %= arr.length;
  return [...arr.slice(-k), ...arr.slice(0, -k)];
};

console.log(moveZeros([0, 1, 0, 3, 12]));    // [1, 3, 12, 0, 0]
console.log(rotateRight([1, 2, 3, 4, 5], 2)); // [4, 5, 1, 2, 3]
```

### 12. Second Largest Number (One Pass)

```js
function secondLargest(nums) {
  let first = -Infinity, second = -Infinity;
  for (const n of nums) {
    if (n > first) [first, second] = [n, first];
    else if (n > second && n !== first) second = n;
  }
  return second === -Infinity ? null : second;
}

console.log(secondLargest([10, 5, 10, 8])); // 8
console.log(secondLargest([3, 3]));         // null
```

### 13. Merge Two Sorted Arrays

```js
function mergeSorted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  return out.concat(a.slice(i), b.slice(j));
}

console.log(mergeSorted([1, 4, 7], [2, 3, 8, 9])); // [1, 2, 3, 4, 7, 8, 9]
```

### 14. Maximum Subarray Sum (Kadane)

```js
function maxSubarray(nums) {
  let best = nums[0], current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}

console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6  ([4, -1, 2, 1])
```

## 🧱 Objects

### 15. Flatten a Nested Object

```js
function flattenObject(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flattenObject(value, path, out);
    else out[path] = value;
  }
  return out;
}

console.log(flattenObject({ user: { name: "Asha", address: { city: "Pune" } }, active: true }));
// { "user.name": "Asha", "user.address.city": "Pune", active: true }
```

### 16. Unflatten (The Reverse)

```js
function unflatten(flat) {
  const result = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    keys.reduce((node, key, i) => (node[key] ??= i === keys.length - 1 ? value : {}), result);
  }
  return result;
}

console.log(JSON.stringify(unflatten({ "a.b.c": 1, "a.d": 2 }))); // {"a":{"b":{"c":1},"d":2}}
```

### 17. Deep Merge

```js
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    out[k] = isObj(v) && isObj(target[k]) ? deepMerge(target[k], v) : v;
  }
  return out;
}

const defaults = { db: { host: "localhost", port: 27017 }, debug: false };
console.log(deepMerge(defaults, { db: { host: "prod-db" }, debug: true }));
// { db: { host: "prod-db", port: 27017 }, debug: true }
```

### 18. Build a Tree From a Flat List (Comments, Categories)

```js
function buildTree(items) {
  const byId = new Map(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId == null) roots.push(node);
    else byId.get(node.parentId)?.children.push(node);
  }
  return roots;
}

const comments = [
  { id: 1, parentId: null, text: "Great post" },
  { id: 2, parentId: 1, text: "Agreed" },
  { id: 3, parentId: 2, text: "Me too" },
  { id: 4, parentId: null, text: "Question?" },
];
console.log(JSON.stringify(buildTree(comments).map((c) => [c.text, c.children.length])));
// [["Great post",1],["Question?",0]]
```

## 🧰 Data Structures

### 19. LRU Cache (Using `Map` Order)

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();           // Map keeps insertion order → first key = least recent
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);           // move to "most recent"
    this.map.set(key, value);
    return value;
  }
  put(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value); // evict LRU
  }
}

const lru = new LRUCache(2);
lru.put("a", 1); lru.put("b", 2);
lru.get("a");                        // a is now most recent
lru.put("c", 3);                     // evicts b
console.log(lru.get("b"), lru.get("a"), lru.get("c")); // -1 1 3
```

### 20. Stack-Based: Valid Parentheses

```js
function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (pairs[ch] && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}

console.log(isValid("{[()]}"), isValid("([)]"), isValid("(("));   // true false false
```

### 21. Run Async Tasks in Series and With a Concurrency Limit

```js
const task = (id, ms) => () => new Promise((r) => setTimeout(() => r(id), ms));

async function series(tasks) {
  const results = [];
  for (const t of tasks) results.push(await t());
  return results;
}

async function limitConcurrency(tasks, limit) {
  const results = [];
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const tasks = [task("A", 30), task("B", 10), task("C", 20), task("D", 5)];
series(tasks).then((r) => console.log("series", r));             // series [A, B, C, D]
limitConcurrency(tasks, 2).then((r) => console.log("limit 2", r)); // limit 2 [A, B, C, D] (order kept)
```

### 22. Sort an Array of Objects by Multiple Keys

```js
const users = [
  { name: "Ravi", age: 30 },
  { name: "Asha", age: 25 },
  { name: "Kiran", age: 30 },
];

const sorted = users.toSorted((a, b) => b.age - a.age || a.name.localeCompare(b.name));
console.log(sorted.map((u) => u.name)); // ["Kiran", "Ravi", "Asha"] — age desc, then name asc
```

## 🎯 Likely Interview Questions

1. **Remove duplicates from an array of objects by `id`.**
2. **Group orders by status and sum their amounts.**
3. **Flatten a nested object / array. What is the time complexity?**
4. **Implement an LRU cache. Why does a `Map` work for it?**
5. **Find the first non-repeating character.**
6. **Build a comment tree from a flat list.**
7. **Run async tasks with a concurrency limit, keeping result order.**
8. **When would you use a `Map` or `Set` instead of an object or array?**

---

[← JS Polyfills & Implementations](02-js-polyfills.md) | [Index](../README.md) | [Next: React Coding Questions →](04-react-coding-questions.md)
