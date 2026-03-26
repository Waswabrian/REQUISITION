// Function to add a new row to the table with id "table2"
function addRow() {
    const table = document.getElementById("add-row");
    const rowCount = table.rows.length;
    const row = table.insertRow(rowCount);
};