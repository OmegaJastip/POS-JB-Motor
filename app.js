let inventory = [];
let customers = [];
let cart = [];
let currentSaleId = null;

document.addEventListener('DOMContentLoaded', () => {
  openDB().then(() => {
    loadInventory();
    loadCustomers();
    setupNavigation();
    setupForms();
  });
});

const setupNavigation = () => {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sections = document.querySelectorAll('.section');
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(btn.id.replace('nav-', '') + '-section').classList.add('active');
    });
  });
};

const setupForms = () => {
  document.getElementById('inventory-form').addEventListener('submit', handleInventorySubmit);
  document.getElementById('inventory-cancel').addEventListener('click', cancelInventoryEdit);
  document.getElementById('sales-form').addEventListener('submit', handleSalesSubmit);
  document.getElementById('complete-sale').addEventListener('click', completeSale);
  document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
  document.getElementById('customer-cancel').addEventListener('click', cancelCustomerEdit);
};

const loadInventory = async () => {
  inventory = await getAllItems('inventory');
  renderInventoryTable();
  updateSalesItemSelect();
};

const renderInventoryTable = () => {
  const tbody = document.querySelector('#inventory-table tbody');
  tbody.innerHTML = '';
  inventory.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price.toLocaleString('id-ID')}</td>
      <td>${item.stock}</td>
      <td>
        <button onclick="editInventory(${item.id})">Edit</button>
        <button onclick="deleteInventory(${item.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });
};

const handleInventorySubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('inventory-id').value;
  const name = document.getElementById('inventory-name').value;
  const price = parseInt(document.getElementById('inventory-price').value);
  const stock = parseInt(document.getElementById('inventory-stock').value);

  const item = { name, price, stock };
  if (id) {
    item.id = parseInt(id);
    await updateItem('inventory', item);
  } else {
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
    document.getElementById('inventory-price').value = item.price;
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
  tbody.innerHTML = '';
  customers.forEach(customer => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${customer.name}</td>
      <td>${customer.phone || '-'}</td>
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
    await updateItem('customers', customer);
  } else {
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
