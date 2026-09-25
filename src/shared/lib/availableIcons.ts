const icons = [
    'apple.svg',
    'beef.svg',
    'cake-slice.svg',
    'coffee.svg',
    'egg-fried.svg',
    'fish.svg',
    'glass-water.svg',
    'hamburger.svg',
    'ice-cream-bowl.svg',
    'pizza.svg',
    'salad.svg',
    'soup.svg',
    'utensils-crossed.svg',
];

/* 
Os icones estão no public para melhorar desempenho ao armazenar qual icone o usuario escolheu para a categoria,
ao inves de armazenar o blob do icone só armazenar a string onde está no public
*/

export const availableIcons = icons.map((icon) => `/icons/${icon}`);
