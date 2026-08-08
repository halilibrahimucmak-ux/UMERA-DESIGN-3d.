import bcrypt from 'bcryptjs';
const password = process.argv[2];
if (!password) {
  console.error('Kullanim: npm run hash-password -- "GucluSifreniz"');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Sifre en az 12 karakter olmali.');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 12));
