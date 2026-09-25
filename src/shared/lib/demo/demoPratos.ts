const demoPratosRaw = [
    {
        title: 'Pizza de Pepperoni',
        image: '/pratosDemo/Pizza de Pepperoni.png',
        category: ['Pizza', 'Italiana'],
    },
    {
        title: 'Hambúrguer com Batata Frita',
        image: '/pratosDemo/Hambúrguer com Batata Frita.png',
        category: ['Lanches', 'Fast Food'],
    },
    {
        title: 'Salada Caesar',
        image: '/pratosDemo/Salada Caesar.png',
        category: ['Saladas', 'Saudável'],
    },
    {
        title: 'Milkshake de Chocolate',
        image: '/pratosDemo/Milkshake de Chocolate.png',
        category: ['Bebidas', 'Sobremesas'],
    },
    {
        title: 'Tacos Mexicanos',
        image: '/pratosDemo/Tacos Mexicanos.png',
        category: ['Mexicana', 'Comida de Rua'],
    },
    {
        title: 'Sanduíche de Frango Grelhado',
        image: '/pratosDemo/Sanduíche de Frango Grelhado.png',
        category: ['Lanches', 'Saudável'],
    },
    {
        title: 'Panquecas com Mel',
        image: '/pratosDemo/Panquecas com Mel.png',
        category: ['Café da manhã', 'Sobremesas'],
    },
    {
        title: 'Cachorro-Quente Americano',
        image: '/pratosDemo/Cachorro-Quente Americano.png',
        category: ['Fast Food', 'Comida de Rua'],
    },
    {
        title: 'Burrito Mexicano',
        image: '/pratosDemo/Burrito Mexicano.png',
        category: ['Mexicana', 'Comida de Rua'],
    },
    {
        title: 'Waffles com Frutas',
        image: '/pratosDemo/Waffles com Frutas.png',
        category: ['Café da manhã', 'Sobremesas'],
    },
];

export async function LoadDemoPratos() {
    return await Promise.all(
        demoPratosRaw.map(async (item) => {
            const res = await fetch(item.image);
            const blob = await res.blob();
            return {
                title: item.title,
                image: blob,
                category: item.category,
            };
        })
    );
}
