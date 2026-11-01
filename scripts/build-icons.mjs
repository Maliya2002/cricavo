import sharp from 'sharp';
// Preserve the existing vector logo; flatten corners for home-screen rendering.
for (const size of [180,192,512]) {
  await sharp('dist/icon.svg').resize(size,size).flatten({background:'#087e63'})
    .png().toFile(`dist/icon-${size}.png`);
}
console.log('Home-screen PNG icons generated from icon.svg.');
