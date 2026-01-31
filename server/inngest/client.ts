import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "meet-ai",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
