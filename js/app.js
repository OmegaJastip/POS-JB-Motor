let inventory = [];
let customers = [];
let cart = [];
let currentSaleId = null;

document.addEventListener('DOMContentLoaded', () => {
  openDB().then(() => {
    if (document.getElementById('analytics-section')) {
      loadAnalytics();
    } else if (document.getElementById('inventory-section')) {
      loadInventory();
      loadCustomers();
      setupForms();
    } else if (document.getElementById('sales-section')) {
      loadInventory();
      loadCustomers();
      setupForms();
      loadSalesHistory();
    } else if (document.getElementById('customers-section')) {
      loadCustomers();
      setupForms();
    } else if (document.getElementById('reports-section')) {
      loadReports();
    }
  });
});

function loadAnalytics() {
  if (!document.getElementById('salesChart')) return;
  Promise.all([getAllItems('sales'), getAllItems('customers')]).then(([sales, customers]) => {
    // Aggregate sales per customer
    const salesPerCustomer = {};
    sales.forEach(sale => {
      if (sale.customerId) {
        salesPerCustomer[sale.customerId] = (salesPerCustomer[sale.customerId] || 0) + sale.total;
      }
    });

    // Aggregate purchases per customer (sum of quantities of items sold to customer)
    const purchasesPerCustomer = {};
    sales.forEach(sale => {
      if (sale.customerId) {
        sale.items.forEach(item => {
          purchasesPerCustomer[sale.customerId] = (purchasesPerCustomer[sale.customerId] || 0) + item.quantity;
        });
      }
    });

    // Prepare labels and data for charts
    const customerNames = customers.map(c => c.name);
    const salesData = customers.map(c => salesPerCustomer[c.id] || 0);
    const purchaseData = customers.map(c => purchasesPerCustomer[c.id] || 0);

    // Create sales chart
    const ctxSales = document.getElementById('salesChart').getContext('2d');
    new Chart(ctxSales, {
      type: 'bar',
      data: {
        labels: customerNames,
        datasets: [{
          label: 'Total Penjualan (Rp)',
          data: salesData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Create purchase chart
    const ctxPurchase = document.getElementById('purchaseChart').getContext('2d');
    new Chart(ctxPurchase, {
      type: 'bar',
      data: {
        labels: customerNames,
        datasets: [{
          label: 'Jumlah Pembelian',
          data: purchaseData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  });
}

const setupForms = () => {
  if (document.getElementById('inventory-form')) {
    document.getElementById('inventory-form').addEventListener('submit', handleInventorySubmit);
    document.getElementById('inventory-cancel').addEventListener('click', cancelInventoryEdit);
  }
  if (document.getElementById('sales-form')) {
    document.getElementById('sales-form').addEventListener('submit', handleSalesSubmit);
    document.getElementById('complete-sale').addEventListener('click', completeSale);
  }
  if (document.getElementById('customer-form')) {
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('customer-cancel').addEventListener('click', cancelCustomerEdit);
  }
  if (document.getElementById('inventory-search')) {
    document.getElementById('inventory-search').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = inventory.filter(item => item.name.toLowerCase().includes(searchTerm));
      renderInventoryTable(filtered);
    });
  }
  if (document.getElementById('export-inventory-csv')) {
    document.getElementById('export-inventory-csv').addEventListener('click', () => {
      const data = [['Nama', 'Harga', 'Stok']];
      inventory.forEach(item => {
        data.push([item.name, item.price, item.stock]);
      });
      exportToCSV(data, 'inventori.csv');
    });
  }
  if (document.getElementById('export-sales-csv')) {
    document.getElementById('export-sales-csv').addEventListener('click', () => {
      const data = [['Tanggal', 'Total', 'Items']];
      getAllItems('sales').then(sales => {
        sales.forEach(sale => {
          const itemsStr = sale.items.map(i => `${i.name}(${i.quantity})`).join('; ');
          data.push([sale.date, sale.total, itemsStr]);
        });
        exportToCSV(data, 'penjualan.csv');
      });
    });
  }
  if (document.getElementById('start-barcode-scan')) {
    document.getElementById('start-barcode-scan').addEventListener('click', () => {
      // Simulate barcode scan
      const scannedCode = prompt('Masukkan kode barcode:');
      if (scannedCode) {
        // Assume scannedCode is item id or name
        const item = inventory.find(i => i.name.toLowerCase().includes(scannedCode.toLowerCase()) || i.id == scannedCode);
        if (item) {
          document.getElementById('sales-item').value = item.id;
          document.getElementById('sales-quantity').value = 1;
        } else {
          alert('Item tidak ditemukan!');
        }
      }
    });
  }
};

const loadInventory = async () => {
  inventory = await getAllItems('inventory');
  renderInventoryTable();
  updateSalesItemSelect();
  updateLowStockNotification();
};

const handleInventorySubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('inventory-id').value;
  const name = document.getElementById('inventory-name').value;
  const price = parseInt(document.getElementById('inventory-price').value.replace(/[^0-9]/g, ''));
  const stock = parseInt(document.getElementById('inventory-stock').value);

  const item = { name, price, stock };
  if (id) {
    item.id = parseInt(id);
    item.updated_at = new Date().toISOString();
    await updateItem('inventory', item);
  } else {
    item.created_at = new Date().toISOString();
    await addItem('inventory', item);
  }

  document.getElementById('inventory-form').reset();
  document.getElementById('inventory-id').value = '';
  document.getElementById('inventory-cancel').style.display = 'none';
  loadInventory();
};

const editInventory = (id) => {
  const item = inventory.find(i => i.id === id);
  if (item) {
    document.getElementById('inventory-id').value = item.id;
    document.getElementById('inventory-name').value = item.name;
    document.getElementById('inventory-price').value = 'Rp ' + item.price.toLocaleString('id-ID');
    document.getElementById('inventory-stock').value = item.stock;
    document.getElementById('inventory-cancel').style.display = 'inline';
  }
};

const cancelInventoryEdit = () => {
  document.getElementById('inventory-form').reset();
  document.getElementById('inventory-id').value = '';
  document.getElementById('inventory-cancel').style.display = 'none';
};

const deleteInventory = async (id) => {
  if (confirm('Apakah Anda yakin ingin menghapus item ini?')) {
    await deleteItem('inventory', id);
    loadInventory();
  }
};

const updateSalesItemSelect = () => {
  const select = document.getElementById('sales-item');
  if (!select) return;
  select.innerHTML = '<option value="">Pilih Alat Motor</option>';
  inventory.forEach(item => {
    if (item.stock > 0) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} - Rp ${item.price.toLocaleString('id-ID')} (Stok: ${item.stock})`;
      select.appendChild(option);
    }
  });
};

const handleSalesSubmit = (e) => {
  e.preventDefault();
  const itemId = parseInt(document.getElementById('sales-item').value);
  const quantity = parseInt(document.getElementById('sales-quantity').value);

  const item = inventory.find(i => i.id === itemId);
  if (item && quantity <= item.stock) {
    const cartItem = cart.find(c => c.id === itemId);
    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      cart.push({ ...item, quantity });
    }
    renderCart();
    document.getElementById('sales-form').reset();
  } else {
    alert('Stok tidak cukup!');
  }
};

const renderCart = () => {
  const tbody = document.querySelector('#cart-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let total = 0;
  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price.toLocaleString('id-ID')}</td>
      <td>${item.quantity}</td>
      <td>${itemTotal.toLocaleString('id-ID')}</td>
      <td><button onclick="removeFromCart(${index})">Hapus</button></td>
    `;
    tbody.appendChild(row);
  });
  document.getElementById('sales-total').textContent = `Total: Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById('complete-sale').disabled = cart.length === 0;
};

const removeFromCart = (index) => {
  cart.splice(index, 1);
  renderCart();
};

const completeSale = async () => {
  if (cart.length === 0) return;

  const sale = {
    items: cart,
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    date: new Date().toISOString()
  };

  await addItem('sales', sale);

  // Update inventory stock
  for (const item of cart) {
    const invItem = inventory.find(i => i.id === item.id);
    if (invItem) {
      invItem.stock -= item.quantity;
      await updateItem('inventory', invItem);
    }
  }

  cart = [];
  renderCart();
  loadInventory();
  alert('Penjualan selesai!');
};

const loadCustomers = async () => {
  customers = await getAllItems('customers');
  renderCustomersTable();
};

const renderCustomersTable = () => {
  const tbody = document.querySelector('#customers-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  customers.forEach(customer => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${customer.name}</td>
      <td>${customer.phone || '-'}</td>
      <td>${customer.created_at ? new Date(customer.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td>
        <button onclick="editCustomer(${customer.id})">Edit</button>
        <button onclick="deleteCustomer(${customer.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });
};

const handleCustomerSubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('customer-id').value;
  const name = document.getElementById('customer-name').value;
  const phone = document.getElementById('customer-phone').value;

  const customer = { name, phone };
  if (id) {
    customer.id = parseInt(id);
    customer.updated_at = new Date().toISOString();
    await updateItem('customers', customer);
  } else {
    customer.created_at = new Date().toISOString();
    await addItem('customers', customer);
  }

  document.getElementById('customer-form').reset();
  document.getElementById('customer-id').value = '';
  document.getElementById('customer-cancel').style.display = 'none';
  loadCustomers();
};

const editCustomer = (id) => {
  const customer = customers.find(c => c.id === id);
  if (customer) {
    document.getElementById('customer-id').value = customer.id;
    document.getElementById('customer-name').value = customer.name;
    document.getElementById('customer-phone').value = customer.phone;
    document.getElementById('customer-cancel').style.display = 'inline';
  }
};

const cancelCustomerEdit = () => {
  document.getElementById('customer-form').reset();
  document.getElementById('customer-id').value = '';
  document.getElementById('customer-cancel').style.display = 'none';
};

const deleteCustomer = async (id) => {
  if (confirm('Apakah Anda yakin ingin menghapus pelanggan ini?')) {
    await deleteItem('customers', id);
    loadCustomers();
  }
};

const updateLowStockNotification = () => {
  const lowStockItems = inventory.filter(item => item.stock > 0 && item.stock <= 5);
  const navInventory = document.getElementById('nav-inventory');
  if (navInventory) {
    if (lowStockItems.length > 0) {
      if (!document.getElementById('low-stock-badge')) {
        const badge = document.createElement('span');
        badge.id = 'low-stock-badge';
        badge.textContent = lowStockItems.length;
        badge.style.backgroundColor = 'red';
        badge.style.color = 'white';
        badge.style.borderRadius = '50%';
        badge.style.padding = '2px 6px';
        badge.style.marginLeft = '5px';
        badge.style.fontSize = '0.8rem';
        navInventory.appendChild(badge);
      } else {
        document.getElementById('low-stock-badge').textContent = lowStockItems.length;
      }
    } else {
      const badge = document.getElementById('low-stock-badge');
      if (badge) {
        badge.remove();
      }
    }
  }
};

const renderInventoryTable = (items = inventory) => {
  const tbody = document.querySelector('#inventory-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('tr');
    if (item.stock > 0 && item.stock <= 5) {
      row.classList.add('low-stock');
    }
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price.toLocaleString('id-ID')}</td>
      <td>${item.stock}</td>
      <td>${item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td>
        <button onclick="editInventory(${item.id})">Edit</button>
        <button onclick="deleteInventory(${item.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });
};

const loadReports = async () => {
  const sales = await getAllItems('sales');
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const revenueEl = document.getElementById('total-revenue');
  if (revenueEl) revenueEl.textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;

  const itemCounts = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const bestSelling = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const list = document.getElementById('best-selling-list');
  if (list) {
    list.innerHTML = '';
    bestSelling.forEach(([name, count]) => {
      const li = document.createElement('li');
      li.textContent = `${name}: ${count} terjual`;
      list.appendChild(li);
    });
  }
};

const loadSalesHistory = async () => {
  const sales = await getAllItems('sales');
  const tbody = document.querySelector('#sales-history-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  sales.forEach(sale => {
    const tr = document.createElement('tr');
    const itemsStr = sale.items.map(i => `${i.name}(${i.quantity})`).join('; ');
    tr.innerHTML = `
      <td>${new Date(sale.date).toLocaleString('id-ID')}</td>
      <td>Rp ${sale.total.toLocaleString('id-ID')}</td>
      <td>${itemsStr}</td>
      <td><button onclick="deleteSale(${sale.id})">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });
};

const deleteSale = async (id) => {
  if (confirm('Apakah Anda yakin ingin menghapus penjualan ini?')) {
    await deleteItem('sales', id);
    loadSalesHistory();
  }
};

const exportToCSV = (data, filename) => {
  const csv = data.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
