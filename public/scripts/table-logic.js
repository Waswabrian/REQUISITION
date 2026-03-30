// Function to add a new row to the table with id "itembody"
function addRow() {
    const tbody = document.getElementById("itembody");
    const rowCount = tbody.rows.length + 1;
    const row = document.createElement("tr");

    row.innerHTML = `
        <td class="sn-cell">${rowCount}</td>
        <td><input type="text" name="budgetLine[]"></td>
        <td><input type="text" name="costCentre[]"></td>
        <td><textarea name="description[]"></textarea></td>
        <td><input type="number" name="qty[]" class="qty-input" min="0"></td>
        <td><input type="number" name="unit[]" class="unit-input" min="0" step="0.01"></td>
        <td><input type="number" name="VAT[]" class="VAT-input" readonly></td>
        <td><input type="number" name="total[]" class="total-input" readonly></td>
        <td><button type="button" onclick="removeRow(this)">-</button></td>
    `;
    tbody.appendChild(row);
}

function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = document.getElementById('itembody');
    row.remove();
    Array.from(tbody.querySelectorAll('tr')).forEach((r, i) => {
        const snCell = r.querySelector('.sn-cell');
        if (snCell) snCell.textContent = i + 1;
    });
    updateGrandTotal();
}

function updateGrandTotal() {
    const totals = document.querySelectorAll('.total-input');
    let grand = 0;
    totals.forEach(el => {
        grand += parseFloat(el.value) || 0;
    });
    const grandTotal = document.getElementById('grand-total');
    if (grandTotal) grandTotal.value = grand.toFixed(2);
}

document.addEventListener('input', function(e){
    if (e.target.classList.contains('qty-input') || e.target.classList.contains('unit-input')) {
        const row = e.target.closest('tr');
        const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
        const unit = parseFloat(row.querySelector('.unit-input').value) || 0;
        const base = qty * unit;
        const vat = base * 0.16; // 16% VAT
        const total = base + vat;

        row.querySelector('.VAT-input').value = vat.toFixed(2);
        row.querySelector('.total-input').value = total.toFixed(2);
        updateGrandTotal();
    }
});