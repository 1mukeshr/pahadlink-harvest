/** Shared FAQ content by page */

export const faqsByPage = {
  home: [
    {
      q: 'What makes PahadLink products different?',
      a: 'We source foods and crafts from Himalayan makers across Uttarakhand and Himachal - clean ingredients, traditional recipes, and honest packaging.',
    },
    {
      q: 'Do you deliver across India?',
      a: 'Yes. We deliver pan-India. Most orders arrive in 2-5 days. Remote or hill areas may take a little longer.',
    },
    {
      q: 'Is shipping free?',
      a: 'First order: free delivery + ₹75 off. Later: ₹39 delivery below ₹499, free above ₹499.',
    },
    {
      q: 'Are your products preservative-free?',
      a: 'Wherever possible, we keep products natural with no unnecessary additives. Each product page lists what matters for that item.',
    },
    {
      q: 'How do I track or change my order?',
      a: 'Login to your account or message us on WhatsApp / care@pahadlink.com with your order details. We reply within 1 business day.',
    },
  ],

  shop: [
    {
      q: 'How do I filter products?',
      a: 'Use the left filters for category, size, price, and collection tags. You can also sort by price, rating, or discount.',
    },
    {
      q: 'Why do sizes look different for each item?',
      a: 'Sizes match the product type - grams for grains and sweets, ml for drinks, or Free size for clothing and crafts.',
    },
    {
      q: 'Can I buy more than one size together?',
      a: 'Yes. Add each size separately to the bag. Your bag keeps every size as its own line item.',
    },
    {
      q: 'Are bestsellers always in stock?',
      a: 'We try to keep popular items ready. If something is low, update yourself via bag checkout or contact support.',
    },
  ],

  product: [
    {
      q: 'How do I choose the right size?',
      a: 'Pick the pack size that matches how fast you use the product. Larger packs usually save more per unit.',
    },
    {
      q: 'When will my order ship?',
      a: 'Orders are packed quickly and usually ship within 24-48 hours on working days, then take 2-5 days in transit.',
    },
    {
      q: 'What if there is an issue with my order?',
      a: 'Contact care@pahadlink.com or WhatsApp support with your order ID and details. We reply within 1 business day.',
    },
  ],

  contact: [
    {
      q: 'How long does delivery take?',
      a: 'Most orders reach in 2-5 days across India. Hill-area deliveries can take a little longer.',
    },
    {
      q: 'Do you offer free shipping?',
      a: 'Yes. First order is free delivery. Later orders are free above ₹499, otherwise ₹39.',
    },
    {
      q: 'What are support hours?',
      a: 'We are available Mon-Sat, 10:00 AM - 7:00 PM IST on phone, WhatsApp, and email.',
    },
  ],

  wishlist: [
    {
      q: 'How do I save products?',
      a: 'Tap the heart on any product card or product page. Saved items appear here for quick access later.',
    },
    {
      q: 'Is my wishlist saved after logout?',
      a: 'Wishlist is stored in this browser. For the same device and browser, your saved items stay available.',
    },
    {
      q: 'How do I move a wishlist item to bag?',
      a: 'Open the product from your wishlist, choose size and quantity, then tap Add to bag.',
    },
  ],

  legal: [
    {
      q: 'Where can I read full policy details?',
      a: 'Use Privacy and Terms for our policies in plain language.',
    },
    {
      q: 'Who do I contact for policy questions?',
      a: 'Reach our support team at +91 96904 21423 or care@pahadlink.com. We reply within 1 business day.',
    },
  ],
}

export const getFaqs = (page) => faqsByPage[page] || faqsByPage.home
