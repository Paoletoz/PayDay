let num = document.querySelector('#num');
let row = document.querySelector('#row');
let btni = document.querySelector('#btni');
let round = document.querySelector('#round');
let btnRound = document.querySelector('#btnRound');

let count = 1;
localStorage.setItem('round', count);


function getPattern(number) {
    count++;
    localStorage.setItem('round', count);
    
    if (number < 100) {
        return "Numero fuori dal range specificato";
    }
    
    
    const baseInterval = 500;
    const baseValue = 50;
    const increment = 50;
    
    let index = Math.ceil((number - 100) / baseInterval);
    num.value = '';
    return baseValue + (index * increment);
}



btni.addEventListener('click', () => {
    
    

    let div = document.createElement('div');
    
    div.innerHTML = `la banca ti deve ${getPattern(num.value)} di interessi e sei al giro numero ${count}`;
    
    round.appendChild(div);
    
})


btnRound.addEventListener('click', () => {

    let div = document.createElement('div');
    div.innerText = `Sei al giro numero ${localStorage.getItem('round')}`;

    round.appendChild(div);
})


