// Function to add a new row to the table with id "itembody"
function addRow() {
    const tbody = document.getElementById("itembody");
    const rowCount = tbody.rows.length + 1;
    const row = document.createElement("tr");

    row.innerHTML = `
        <td><input type="number" name="sn[]" value="${rowCount}" readonly></td>
        <td><input type="text" name="budgetLine[]"></td>
        <td><input type="text" name="costCentre[]"></td>
        <td><textarea name="description[]"></textarea></td>
        <td><input type="number" name="qty[]" class="qty-input" min="0"></td>
        <td><input type="number" name="unit[]" class="unit-input" min="0" step="0.01"></td>
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
        const snInput = r.querySelector('input[name="sn[]"]');
        if (snInput) snInput.value = i + 1;
    });
}

document.addEventListener('input', function(e){
    if (e.target.classList.contains('qty-input') || e.target.classList.contains('unit-input')) {
        const row = e.target.closest('tr');
        const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
        const unit = parseFloat(row.querySelector('.unit-input').value) || 0;
        row.querySelector('.total-input').value = (qty * unit).toFixed(2);
    }
});