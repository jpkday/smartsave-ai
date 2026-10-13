// Reads a pasted grocery/meal note without AI. Handles the common Apple Notes shape:
// checklists ("- [ ] item" still needed, "- [x] item" done), section headings
// ("Meals:", "Meat", "Wegmans only"), weekday lines ("Tue - tacos"), and
// "need: milk, eggs" lines.

export interface ParsedNote {
  // 0 = Monday … 6 = Sunday
  days: { weekday: number; meal: string }[];
  meals: string[];
  ideas: string[];
  grocery_items: string[];
}

const WEEKDAY = /^(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\.?\s*(?:[-–—:]\s*)?(.+)$/i;
const WEEKDAY_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
const CHECKLIST = /^[-*•]?\s*\[( |x|X|✓|✔)\]\s*(.+)$/;
const BULLET = /^[-*•]\s+(.+)$/;

const tidy = (s: string) => {
  const t = s.replace(/\s+/g, ' ').replace(/\s*[-–]\s*(lunch(es)?)$/i, ' ($1)').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function parseNote(text: string): ParsedNote {
  const result: ParsedNote = { days: [], meals: [], ideas: [], grocery_items: [] };
  let section: 'groceries' | 'meals' | 'ideas' = 'groceries';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const check = line.match(CHECKLIST);
    if (check && check[1].trim() !== '') continue; // checked off: already bought or made
    const bullet = !check && line.match(BULLET);
    const body = (check ? check[2] : bullet ? bullet[1] : line).trim();

    // A bare line (no checkbox/bullet) is a heading unless it carries content
    if (!check && !bullet) {
      const heading = body.replace(/:$/, '').toLowerCase();
      const need = body.match(/^(need|buy|get|groceries)\s*:\s*(.+)$/i);
      if (need) {
        need[2].split(/,|;/).map((x) => x.trim()).filter(Boolean).forEach((x) => result.grocery_items.push(tidy(x)));
        continue;
      }
      const maybe = body.match(/^(maybe|ideas?|options?)\s*:\s*(.+)$/i);
      if (maybe) {
        maybe[2].split(/,|;/).map((x) => x.trim()).filter(Boolean).forEach((x) => result.ideas.push(tidy(x)));
        continue;
      }
      if (!WEEKDAY.test(body)) {
        if (/meal|dinner|menu/.test(heading)) section = 'meals';
        else if (/idea|maybe|option/.test(heading)) section = 'ideas';
        else section = 'groceries';
        // A colon heading with text after it ("Meals: tacos") still counts as content
        const after = body.split(':').slice(1).join(':').trim();
        if (!after) continue;
      }
    }

    const day = body.match(WEEKDAY);
    if (day) {
      result.days.push({ weekday: WEEKDAY_INDEX[day[1].slice(0, 3).toLowerCase()], meal: tidy(day[2]) });
    } else if (section === 'meals') {
      result.meals.push(tidy(body));
    } else if (section === 'ideas') {
      result.ideas.push(tidy(body));
    } else {
      result.grocery_items.push(tidy(body));
    }
  }
  return result;
}
