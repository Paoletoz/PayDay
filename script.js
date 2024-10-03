let num = document.querySelector('#num');
let row = document.querySelector('#row');
let btni = document.querySelector('#btni');
let wrapper = document.querySelector('#wrapper');
let btnRound = document.querySelector('#btnRound');
let giro = document.querySelector('#giro');

let count = 1;
localStorage.setItem('round', count);


function getPattern(number) {
    count++;
    localStorage.setItem('round', count);
    
    
    
    const baseInterval = 500;
    const baseValue = 50;
    const increment = 50;
    
    let index = Math.ceil((number - 100) / baseInterval);
    num.value = '';
    return baseValue + (index * increment);
}



btni.addEventListener('click', () => {
    
    
    let partial = getPattern(num.value);
    let div = document.createElement('div');
    let total = partial + 1500;
    
    wrapper.innerHTML = `` 

    div.innerHTML = `
        <div class="container">
            <div class="row">
                <div class="col-12 col-6">
                    <p>la banca ti deve ${partial}€ di interessi e 1500€ di stipendio</p>
                </div>
                <div class="col-12 col-6 mt-5">
                    <p>Totale: ${total}€</p>
                    <p>Giro: ${count}</p>
                </div>
            </div>
        </div>
    `
    
    wrapper.appendChild(div);
    
})


btnRound.addEventListener('click', () => {
    
    giro.innerHTML = `` 
    let div = document.createElement('div');
    div.innerText = `Sei al giro numero ${localStorage.getItem('round')}`;
    
    giro.appendChild(div);
})


