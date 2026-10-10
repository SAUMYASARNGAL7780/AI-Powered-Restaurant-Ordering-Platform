import 'dotenv/config';
import mongoose from 'mongoose';
import MenuItem from './models/MenuItem.js';

// Sample menu matching the FSSAI categories on your licence (Prepared Foods, Eggs, Beverages).
// Prices are placeholders: edit them in the admin dashboard.
export const SAMPLE_MENU = [
  { name: 'Signature Paneer Paratha', description: 'Crisp tawa paratha stuffed with spiced paneer, served with tangy tomato dip.', category: 'Prepared Foods', price: 120, isVeg: true, spice: 1, tags: ['paratha', 'paneer', 'signature'] },
  { name: 'Aloo Paratha with Curd', description: 'Whole wheat paratha filled with masala potato, served with fresh curd and butter.', category: 'Prepared Foods', price: 80, isVeg: true, spice: 1, tags: ['paratha', 'aloo', 'breakfast'] },
  { name: 'Grilled Paneer Bites', description: 'Golden pan-grilled paneer slices with herbs and a spicy tomato dip.', category: 'Prepared Foods', price: 180, isVeg: true, spice: 2, tags: ['paneer', 'starter', 'grilled', 'protein'] },
  { name: 'Butter Naan Platter', description: 'Soft tawa naans brushed with butter and coriander, served with house dip.', category: 'Prepared Foods', price: 140, isVeg: true, spice: 1, tags: ['naan', 'bread', 'platter'] },
  { name: 'Veg Momos (6 pcs)', description: 'Steamed dumplings with cabbage and carrot filling, served with fiery red chutney.', category: 'Prepared Foods', price: 90, isVeg: true, spice: 2, tags: ['momos', 'steamed', 'snack'] },
  { name: 'Chilli Garlic Maggi', description: 'Street-style noodles tossed with green chilli, garlic and vegetables.', category: 'Prepared Foods', price: 70, isVeg: true, spice: 3, tags: ['maggi', 'noodles', 'hot', 'snack'] },
  { name: 'Veg Grilled Sandwich', description: 'Toasted sandwich with cucumber, tomato, onion and mint chutney. Not spicy, kid friendly.', category: 'Prepared Foods', price: 80, isVeg: true, spice: 0, tags: ['sandwich', 'kids', 'light'] },
  { name: 'Masala Omelette', description: 'Two-egg omelette with onion, tomato, green chilli and coriander.', category: 'Eggs', price: 60, isVeg: false, spice: 2, tags: ['egg', 'omelette', 'breakfast', 'protein'] },
  { name: 'Egg Bhurji with Pav', description: 'Spiced scrambled eggs cooked with onions and tomatoes, served with buttered pav.', category: 'Eggs', price: 90, isVeg: false, spice: 2, tags: ['egg', 'bhurji', 'pav'] },
  { name: 'Egg Sandwich', description: 'Soft toasted sandwich with boiled egg, pepper and light mayo. Mild.', category: 'Eggs', price: 80, isVeg: false, spice: 1, tags: ['egg', 'sandwich', 'light'] },
  { name: 'Egg Paratha', description: 'Tawa paratha cooked with a beaten egg layer, served with curd.', category: 'Eggs', price: 100, isVeg: false, spice: 1, tags: ['egg', 'paratha'] },
  { name: 'Masala Chai', description: 'Hot milk tea brewed with ginger and cardamom.', category: 'Beverages', price: 20, isVeg: true, spice: 0, tags: ['tea', 'hot drink', 'cheap'] },
  { name: 'Kashmiri Kahwa', description: 'Traditional green tea with saffron, cardamom, cinnamon and almonds.', category: 'Beverages', price: 40, isVeg: true, spice: 0, tags: ['tea', 'kashmiri', 'saffron', 'hot drink'] },
  { name: 'Cold Coffee', description: 'Chilled blended coffee, sweet and creamy.', category: 'Beverages', price: 90, isVeg: true, spice: 0, tags: ['coffee', 'cold drink', 'sweet'] },
  { name: 'Fresh Lime Soda', description: 'Sweet or salted lime soda, refreshing and light.', category: 'Beverages', price: 50, isVeg: true, spice: 0, tags: ['lime', 'cold drink', 'refreshing', 'cheap'] },
  { name: 'Peach Iced Tea', description: 'Chilled black tea with peach flavour.', category: 'Beverages', price: 60, isVeg: true, spice: 0, tags: ['tea', 'cold drink'] },
];

export async function seedIfEmpty() {
  if ((await MenuItem.countDocuments()) > 0) return false;
  await MenuItem.insertMany(SAMPLE_MENU);
  console.log(`[seed] added ${SAMPLE_MENU.length} sample menu items`);
  return true;
}

// `npm run seed` : wipes the menu and loads the samples again.
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  await mongoose.connect(process.env.MONGODB_URI);
  await MenuItem.deleteMany({});
  await MenuItem.insertMany(SAMPLE_MENU);
  console.log(`Seeded ${SAMPLE_MENU.length} items`);
  await mongoose.disconnect();
}
