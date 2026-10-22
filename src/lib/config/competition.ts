// Organizer-supplied facts only. Dates, eligibility rules and assets can be added here.
export const competition = {
  name: "Vertex League",
  description: "A place for your team. A chance to prove it on the pitch.",
  country: "NG" as const,
  allowInternationalPhones: false,
  rules: [
    "One team per manager. Each team may register only once.",
    "Save your team details first, then use the bank details on your payment page to make a transfer. Send your receipt and team logo to the organizer on WhatsApp.",
    "Your place is provisionally booked after the organizer confirms payment.",
    "Teams and players must attend physical eligibility screening after the registration deadline.",
    "Player details are collected at the screening venue.",
    "Final entry requires the organizer’s approval after screening.",
    "Teams that pay but fail eligibility approval receive the full registration fee back, with no deductions.",
  ],
  eligibility: [] as string[],
  faq: [
    {
      question: "What do I need to register?",
      answer:
        "Your team name and location, your full name, phone number and WhatsApp number. Email is optional. Send your team logo directly to the organizer on WhatsApp after payment. Player details will be collected at physical screening.",
    },
    {
      question: "How do I pay the registration fee?",
      answer:
        "Complete the registration form and click Save & continue to payment. Your team details are saved before your private payment page opens with the fee and bank details. Copy the account number, check the beneficiary name and transfer the exact amount.",
    },
    {
      question: "Where do I send my receipt and team logo?",
      answer:
        "Use the WhatsApp button on your payment page. It opens the organizer’s chat with your registration details prefilled. Attach your payment receipt and team logo yourself, then press Send. Logo files are sent in WhatsApp rather than uploaded on the website.",
    },
    {
      question: "When is my place booked?",
      answer:
        "Your place is provisionally booked when the organizer checks the bank transfer and records Payment received. Opening WhatsApp or sending a receipt does not confirm payment.",
    },
    {
      question: "Does payment mean my team is approved?",
      answer:
        "Payment books a provisional place. Final approval follows physical screening of your team and players after the registration deadline.",
    },
    {
      question: "What if my team does not pass screening?",
      answer:
        "Teams that paid but fail eligibility approval receive a full refund of the registration fee they actually paid, with no deductions. The organizer arranges the transfer and records its progress on your team page.",
    },
    {
      question: "Can I correct my details or send another receipt?",
      answer:
        "Sign in to make permitted corrections. If editing is locked, contact the organizer to request a correction. You can resend proof on WhatsApp using the same reference.",
    },
    {
      question: "How do I recover my registration?",
      answer:
        "Sign in with your verified email and password to see your team. If you forget your password, use the reset link on the sign-in page. For an older registration without a matching email, contact the organizer.",
    },
  ],
};
