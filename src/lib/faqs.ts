// Knowledge base for "Nimbus", a fictional project-management SaaS.
// The assistant may only state Nimbus-specific facts that appear here.

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    id: "refund-policy",
    question: "What is your refund policy?",
    answer:
      "Customers can request a full refund within 30 days of purchase, on both monthly and annual plans. Go to Settings → Billing → Request refund, or email billing@nimbus.example. Refunds go back to the original payment method within 5–7 business days.",
  },
  {
    id: "password-reset",
    question: "How do I reset my password?",
    answer:
      'Click "Forgot password?" on the login page and enter your account email. The reset link is valid for 60 minutes; check your spam folder if it does not arrive. If your company signs in with SSO, reset your password through your company\'s identity provider instead.',
  },
  {
    id: "plans-pricing",
    question: "What plans and prices do you offer?",
    answer:
      "Free: up to 3 users and 5 projects. Pro: $12 per user/month billed monthly, or $10 per user/month billed annually. Business: $24 per user/month, adds SSO, audit logs and priority support.",
  },
  {
    id: "change-plan",
    question: "How do I upgrade or downgrade my plan?",
    answer:
      "Go to Settings → Billing → Change plan. Upgrades take effect immediately and you are charged a prorated amount. Downgrades take effect at the end of the current billing cycle.",
  },
  {
    id: "cancel-subscription",
    question: "How do I cancel my subscription?",
    answer:
      "Go to Settings → Billing → Cancel subscription. You keep access until the end of the period you have paid for. Workspace data is kept for 90 days after cancellation and then permanently deleted.",
  },
  {
    id: "invite-members",
    question: "How do I invite team members?",
    answer:
      "Workspace admins can go to Settings → Members → Invite and enter email addresses. Invitations expire after 7 days. Each member uses one seat on your plan.",
  },
  {
    id: "two-factor",
    question: "How do I set up two-factor authentication (2FA)?",
    answer:
      "Go to Settings → Security → Enable 2FA and scan the QR code with an authenticator app. Save your backup codes. If you lose your device, sign in with a backup code; without backup codes, contact support to verify your identity.",
  },
  {
    id: "data-export",
    question: "How can I export my data?",
    answer:
      "Go to Settings → Workspace → Export and choose CSV or JSON. Small exports download immediately; large exports are emailed to you within 24 hours.",
  },
  {
    id: "contact-support",
    question: "How do I contact a human / what are your support hours?",
    answer:
      "Email support@nimbus.example or use live chat, Monday to Friday, 9:00–18:00 IST. Business plan customers get priority support with a 4-hour response time.",
  },
  {
    id: "integrations",
    question: "Which integrations do you support?",
    answer:
      "Nimbus integrates with Slack, Google Drive, GitHub and Zapier. Connect them from Settings → Integrations.",
  },
];

export const FAQ_BY_ID = new Map(FAQS.map((faq) => [faq.id, faq]));
