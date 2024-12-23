let num = document.querySelector('#num');
let btni = document.querySelector('#btni');
let wrapper = document.querySelector('#wrapper');
let btnRound = document.querySelector('#btnRound');
let giro = document.querySelector('#giro');
let poste = document.querySelector('#poste')

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
    
    
    let partial = Number(num.value) > 50 ? getPattern(num.value) : 0;
    let div = document.createElement('div');
    let total = (partial + 1500) - poste.value;
    
    wrapper.innerHTML = `` 

    div.innerHTML = `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12 col-6">
                    <p>la banca ti deve ${partial > 0 ? partial + "€ di interessi e ": ""} 1500€ di stipendio ${poste.value > 0 ? "e devi pagare " + poste.value + "€" : ""}</p>
                </div>
                <div class="col-12 col-6 mt-5">
                    <p class="bg-">Totale: ${total}€</p>
                    ${poste.value > 0 ? "<p class='bg-danger'>Totale poste:" + poste.value + "€</p>": ""}
                    <p>Giro: ${count}</p>
                </div>
            </div>
        </div>
    `

    num.value = ""
    poste.value = ""
    
    wrapper.appendChild(div);
    
})


btnRound.addEventListener('click', () => {
    
    giro.innerHTML = `` 
    let div = document.createElement('div');
    div.innerText = `Sei al giro numero ${localStorage.getItem('round')}`;
    
    giro.appendChild(div);
})


