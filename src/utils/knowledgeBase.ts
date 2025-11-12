import kb from "./kb.json";

interface KBEntry {
  title: string;
  answer: string;
  keywords: string[];
}

const baseEntries: KBEntry[] = [
  {
    title: "Address",
    answer: `We are located at ${kb.address}. Parliament Station and multiple tram lines stop within 3 minutes.`,
    keywords: ["where", "address", "located", "location", "parliament", "collins"],
  },
  {
    title: "Hours",
    answer: `We are open ${kb.hours.weekdays}, ${kb.hours.saturday}, and ${kb.hours.sunday}.`,
    keywords: ["hours", "open", "close", "opening", "closing", "when"],
  },
  {
    title: "Contact",
    answer: `You can reach us on ${kb.contact.phone} or ${kb.contact.email}.`,
    keywords: ["contact", "phone", "email", "call", "number"],
  },
  {
    title: "Values",
    answer: `We believe in ${kb.values.join(", ")}.`,
    keywords: ["philosophy", "values", "approach", "what do you believe"],
  },
];

const serviceEntries: KBEntry[] = kb.services.map((service) => ({
  title: service.name,
  answer: `${service.name} runs for ${service.duration} at $${service.price}. ${service.description}`,
  keywords: [service.name.toLowerCase(), ...service.keywords],
}));

const faqEntries: KBEntry[] = kb.faqs.map((faq) => ({
  title: faq.question,
  answer: faq.answer,
  keywords: faq.tags,
}));

const entries = [...baseEntries, ...serviceEntries, ...faqEntries];

export function searchKnowledgeBase(query: string): string | undefined {
  const lower = query.toLowerCase();

  const scored = entries
    .map((entry) => ({
      entry,
      score: entry.keywords.reduce(
        (acc, keyword) => (lower.includes(keyword) ? acc + keyword.length : acc),
        0
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.entry.answer;
}

export function businessSummary(): string {
  return `${kb.businessName}: ${kb.tagline}`;
}

export function listServices(): string {
  return kb.services
    .map((service) => `${service.name} (${service.duration}) - $${service.price}`)
    .join("; ");
}
