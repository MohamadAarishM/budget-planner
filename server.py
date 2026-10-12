#!/usr/bin/env python3
"""
Personal Budget Planner - REST API & SQLite Backend Server
Implements the Backend Blueprint specification with SQLite persistence,
API conventions (/api/v1/...), validation, and static frontend delivery.
"""

import os
import sys
import json
import sqlite3
import re
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime

PORT = 8000
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'budget.db')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes tables and seeds October 2026 reference records if empty."""
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        created_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_name TEXT DEFAULT 'Mohamad Aarish',
        user_email TEXT DEFAULT 'mohamadaarish.m@budgetnest.app',
        currency_code TEXT DEFAULT 'INR',
        currency_symbol TEXT DEFAULT '₹',
        week_start TEXT DEFAULT 'monday',
        starting_balance_minor INTEGER DEFAULT 5000000,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        archived_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT,
        category_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT,
        user_id TEXT DEFAULT 'user_aarish',
        FOREIGN KEY (category_id) REFERENCES categories (id)
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS monthly_budgets (
        month TEXT PRIMARY KEY, -- YYYY-MM
        amount_minor INTEGER NOT NULL DEFAULT 5000000,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS category_budgets (
        month TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount_minor INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (month, category_id),
        FOREIGN KEY (category_id) REFERENCES categories (id)
    );
    """)

    # Schema Migrations
    try:
        cur.execute("ALTER TABLE settings ADD COLUMN starting_balance_minor INTEGER DEFAULT 5000000;")
    except sqlite3.OperationalError:
        pass

    try:
        cur.execute("ALTER TABLE transactions ADD COLUMN user_id TEXT DEFAULT 'user_aarish';")
    except sqlite3.OperationalError:
        pass

    # Update any legacy email domains
    cur.execute("UPDATE users SET email = REPLACE(email, '@budget.app', '@budgetnest.app');")
    cur.execute("UPDATE settings SET user_email = REPLACE(user_email, '@budget.app', '@budgetnest.app');")

    # Check if empty, seed defaults
    cur.execute("SELECT COUNT(*) as cnt FROM users;")
    if cur.fetchone()['cnt'] == 0:
        default_users = [
            ('user_aarish', 'Mohamad Aarish', 'mohamadaarish.m@budgetnest.app', 'password123', 'MA', datetime.utcnow().isoformat() + 'Z'),
            ('user_sarah', 'Sarah Jenkins', 'sarah.j@budgetnest.app', 'password123', 'SJ', datetime.utcnow().isoformat() + 'Z'),
            ('user_priya', 'Priya Sharma', 'priya.s@budgetnest.app', 'password123', 'PS', datetime.utcnow().isoformat() + 'Z')
        ]
        cur.executemany("INSERT INTO users (id, name, email, password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?);", default_users)

    cur.execute("SELECT COUNT(*) as cnt FROM settings;")
    if cur.fetchone()['cnt'] == 0:
        cur.execute("""
        INSERT INTO settings (id, user_name, user_email, currency_code, currency_symbol, week_start, starting_balance_minor, updated_at)
        VALUES (1, 'Mohamad Aarish', 'mohamadaarish.m@budgetnest.app', 'INR', '₹', 'monday', 5000000, datetime('now'));
        """)

    cur.execute("SELECT COUNT(*) as cnt FROM categories;")
    if cur.fetchone()['cnt'] == 0:
        initial_cats = [
            ('salary', 'Salary', 'income', '💼', '#10B981'),
            ('freelance', 'Freelance', 'income', '💻', '#06B6D4'),
            ('food', 'Food & Dining', 'expense', '🍽️', '#F59E0B'),
            ('transport', 'Transport', 'expense', '🚇', '#3B82F6'),
            ('housing', 'Housing', 'expense', '🏠', '#8B5CF6'),
            ('utilities', 'Utilities', 'expense', '⚡', '#EC4899'),
            ('shopping', 'Shopping', 'expense', '🛍️', '#F97316'),
            ('health', 'Health', 'expense', '💊', '#14B8A6'),
            ('entertainment', 'Entertainment', 'expense', '🎬', '#A855F7')
        ]
        cur.executemany("INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?);", initial_cats)

    cur.execute("SELECT COUNT(*) as cnt FROM monthly_budgets WHERE month = '2026-10';")
    if cur.fetchone()['cnt'] == 0:
        # ₹50,000 = 5,000,000 paise
        cur.execute("INSERT INTO monthly_budgets (month, amount_minor, updated_at) VALUES ('2026-10', 5000000, datetime('now'));")

    cur.execute("SELECT COUNT(*) as cnt FROM category_budgets WHERE month = '2026-10';")
    if cur.fetchone()['cnt'] == 0:
        cat_limits = [
            ('2026-10', 'housing', 1500000),      # ₹15,000
            ('2026-10', 'food', 1000000),         # ₹10,000
            ('2026-10', 'transport', 500000),     # ₹5,000
            ('2026-10', 'utilities', 400000),     # ₹4,000
            ('2026-10', 'shopping', 500000),      # ₹5,000
            ('2026-10', 'health', 300000),        # ₹3,000
            ('2026-10', 'entertainment', 400000)  # ₹4,000
        ]
        cur.executemany("INSERT INTO category_budgets (month, category_id, amount_minor, updated_at) VALUES (?, ?, ?, datetime('now'));", cat_limits)

    cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE date LIKE '2026-10%';")
    if cur.fetchone()['cnt'] == 0:
        sample_txns = [
            ('txn_01', '2026-10-01', 'October salary', 'salary', 'income', 4200000, '2026-10-01T09:00:00Z'),
            ('txn_02', '2026-10-02', 'October rent', 'housing', 'expense', 1500000, '2026-10-02T10:00:00Z'),
            ('txn_03', '2026-10-03', 'Weekly groceries', 'food', 'expense', 85000, '2026-10-03T11:30:00Z'),
            ('txn_04', '2026-10-04', 'Metro card recharge', 'transport', 'expense', 12000, '2026-10-04T08:45:00Z'),
            ('txn_05', '2026-10-05', 'Logo design project', 'freelance', 'income', 500000, '2026-10-05T15:20:00Z'),
            ('txn_06', '2026-10-06', 'Electricity bill', 'utilities', 'expense', 18000, '2026-10-06T14:10:00Z'),
            ('txn_07', '2026-10-07', 'Dinner with friends', 'food', 'expense', 45000, '2026-10-07T20:15:00Z'),
            ('txn_08', '2026-10-08', 'Movie tickets', 'entertainment', 'expense', 24000, '2026-10-08T18:00:00Z'),
            ('txn_09', '2026-10-09', 'Running shoes', 'shopping', 'expense', 32000, '2026-10-09T16:40:00Z'),
            ('txn_10', '2026-10-10', 'Pharmacy', 'health', 'expense', 15000, '2026-10-10T12:05:00Z'),
            ('txn_11', '2026-10-11', 'Groceries', 'food', 'expense', 78000, '2026-10-11T11:15:00Z'),
            ('txn_12', '2026-10-12', 'Taxi', 'transport', 'expense', 9000, '2026-10-12T09:30:00Z'),
            ('txn_13', '2026-10-13', 'Internet bill', 'utilities', 'expense', 28000, '2026-10-13T10:00:00Z'),
            ('txn_14', '2026-10-14', 'Restaurant lunch', 'food', 'expense', 60000, '2026-10-14T13:45:00Z'),
            ('txn_15', '2026-10-15', 'Household supplies', 'shopping', 'expense', 22000, '2026-10-15T17:10:00Z')
        ]
        cur.executemany("""
        INSERT INTO transactions (id, date, description, category_id, type, amount_minor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """, sample_txns)

    conn.commit()
    conn.close()

class BudgetRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and no-cache for local API
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))

    def send_api_error(self, status, code, message, details=None):
        error_body = {
            "error": {
                "code": code,
                "message": message,
                "details": details or []
            }
        }
        self.send_json(status, error_body)

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode('utf-8')
            return json.loads(body)
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Health Check
        if path == '/api/v1/health':
            self.send_json(200, {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"})
            return

        # Auth Users List: GET /api/v1/auth/users
        if path == '/api/v1/auth/users':
            conn = get_db()
            rows = conn.execute("SELECT id, name, email, avatar, created_at FROM users;").fetchall()
            conn.close()
            self.send_json(200, {"data": [dict(r) for r in rows]})
            return

        # Database Info: GET /api/v1/db/info
        if path == '/api/v1/db/info':
            conn = get_db()
            cur = conn.cursor()
            tables = ['users', 'settings', 'categories', 'transactions', 'monthly_budgets', 'category_budgets']
            table_counts = {}
            for t in tables:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {t};")
                    table_counts[t] = cur.fetchone()[0]
                except Exception:
                    table_counts[t] = 0
            cur.execute("SELECT sqlite_version();")
            sql_ver = cur.fetchone()[0]
            conn.close()

            db_size = os.path.getsize(DB_FILE) if os.path.exists(DB_FILE) else 0
            self.send_json(200, {
                "data": {
                    "status": "connected",
                    "engine": f"SQLite {sql_ver}",
                    "sqliteVersion": sql_ver,
                    "databaseFile": DB_FILE,
                    "databaseName": os.path.basename(DB_FILE),
                    "filename": os.path.basename(DB_FILE),
                    "sizeBytes": db_size,
                    "size_bytes": db_size,
                    "sizeFormatted": f"{db_size / 1024:.1f} KB",
                    "tableCounts": table_counts,
                    "stats": table_counts
                }
            })
            return

        # Settings: GET /api/v1/settings
        if path == '/api/v1/settings':
            conn = get_db()
            row = conn.execute("SELECT * FROM settings WHERE id = 1;").fetchone()
            conn.close()
            if row:
                d = dict(row)
                self.send_json(200, {
                    "data": {
                        "id": d.get('id', 1),
                        "userName": d.get('user_name', 'Mohamad Aarish'),
                        "userEmail": d.get('user_email', 'mohamadaarish.m@budgetnest.app'),
                        "currencyCode": d.get('currency_code', 'INR'),
                        "currencySymbol": d.get('currency_symbol', '₹'),
                        "weekStart": d.get('week_start', 'monday'),
                        "startingBalanceMinor": d.get('starting_balance_minor', 5000000),
                        "updatedAt": d.get('updated_at')
                    }
                })
            else:
                self.send_api_error(404, "NOT_FOUND", "Settings not found")
            return

        # Categories List
        if path == '/api/v1/categories':
            cat_type = query.get('type', [None])[0]
            conn = get_db()
            if cat_type:
                rows = conn.execute("SELECT * FROM categories WHERE type = ?;", (cat_type,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM categories;").fetchall()
            conn.close()
            self.send_json(200, {"data": [dict(r) for r in rows]})
            return

        # List Transactions
        if path == '/api/v1/transactions':
            month = query.get('month', [None])[0]
            search = query.get('search', [None])[0]
            txn_type = query.get('type', [None])[0]
            cat_id = query.get('categoryId', [None])[0]
            sort_order = query.get('sort', ['newest'])[0]

            sql = "SELECT t.*, c.name as category_name, c.icon as category_icon FROM transactions t JOIN categories c ON t.category_id = c.id WHERE 1=1"
            params = []

            if month:
                sql += " AND t.date LIKE ?"
                params.append(f"{month}%")
            if txn_type and txn_type != 'all':
                sql += " AND t.type = ?"
                params.append(txn_type)
            if cat_id and cat_id != 'all':
                sql += " AND t.category_id = ?"
                params.append(cat_id)
            if search:
                sql += " AND (t.description LIKE ? OR c.name LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])

            if sort_order == 'oldest':
                sql += " ORDER BY t.date ASC, t.id ASC"
            elif sort_order == 'largest':
                sql += " ORDER BY t.amount_minor DESC"
            else:
                sql += " ORDER BY t.date DESC, t.id DESC"

            conn = get_db()
            rows = conn.execute(sql, params).fetchall()
            conn.close()
            self.send_json(200, {"data": [dict(r) for r in rows], "count": len(rows)})
            return

        # Single Transaction GET /api/v1/transactions/:id
        tx_match = re.match(r'^/api/v1/transactions/([^/]+)$', path)
        if tx_match:
            tx_id = tx_match.group(1)
            conn = get_db()
            row = conn.execute("SELECT * FROM transactions WHERE id = ?;", (tx_id,)).fetchone()
            conn.close()
            if row:
                self.send_json(200, {"data": dict(row)})
            else:
                self.send_api_error(404, "NOT_FOUND", f"Transaction '{tx_id}' not found")
            return

        # Monthly Budget GET /api/v1/budgets/:month
        budget_match = re.match(r'^/api/v1/budgets/(\d{4}-\d{2})$', path)
        if budget_match:
            month = budget_match.group(1)
            conn = get_db()
            mb = conn.execute("SELECT * FROM monthly_budgets WHERE month = ?;", (month,)).fetchone()
            cb_rows = conn.execute("SELECT category_id, amount_minor FROM category_budgets WHERE month = ?;", (month,)).fetchall()
            conn.close()

            monthly_budget_minor = mb['amount_minor'] if mb else 5000000
            category_map = {r['category_id']: r['amount_minor'] for r in cb_rows}
            self.send_json(200, {
                "data": {
                    "month": month,
                    "monthlyBudgetMinor": monthly_budget_minor,
                    "categories": category_map
                }
            })
            return

        # Report Summary: GET /api/v1/reports/summary?month=2026-10
        if path == '/api/v1/reports/summary':
            month = query.get('month', ['2026-10'])[0]
            conn = get_db()
            mb = conn.execute("SELECT amount_minor FROM monthly_budgets WHERE month = ?;", (month,)).fetchone()
            budget_minor = mb['amount_minor'] if mb else 5000000

            # Income sum
            inc_row = conn.execute("SELECT COALESCE(SUM(amount_minor), 0) as total FROM transactions WHERE date LIKE ? AND type = 'income';", (f"{month}%",)).fetchone()
            income_minor = inc_row['total']

            # Expense sum
            exp_row = conn.execute("SELECT COALESCE(SUM(amount_minor), 0) as total FROM transactions WHERE date LIKE ? AND type = 'expense';", (f"{month}%",)).fetchone()
            expenses_minor = exp_row['total']
            conn.close()

            # Formulas
            budget_remaining_minor = budget_minor - expenses_minor
            available_balance_minor = budget_minor + income_minor - expenses_minor
            net_minor = income_minor - expenses_minor

            self.send_json(200, {
                "data": {
                    "month": month,
                    "budgetMinor": budget_minor,
                    "incomeMinor": income_minor,
                    "expensesMinor": expenses_minor,
                    "budgetRemainingMinor": budget_remaining_minor,
                    "availableBalanceMinor": available_balance_minor,
                    "netMinor": net_minor
                }
            })
            return

        # Report by category: GET /api/v1/reports/by-category?month=2026-10
        if path == '/api/v1/reports/by-category':
            month = query.get('month', ['2026-10'])[0]
            conn = get_db()
            rows = conn.execute("""
            SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(t.amount_minor), 0) as amount_minor
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id AND t.date LIKE ? AND t.type = 'expense'
            WHERE c.type = 'expense'
            GROUP BY c.id
            HAVING amount_minor > 0
            ORDER BY amount_minor DESC;
            """, (f"{month}%",)).fetchall()
            conn.close()
            self.send_json(200, {"data": [dict(r) for r in rows]})
            return

        # Data export: GET /api/v1/export?format=csv|json
        if path == '/api/v1/export':
            fmt = query.get('format', ['json'])[0]
            conn = get_db()
            txns = [dict(r) for r in conn.execute("SELECT * FROM transactions ORDER BY date DESC;").fetchall()]
            cats = [dict(r) for r in conn.execute("SELECT * FROM categories;").fetchall()]
            settings_row = dict(conn.execute("SELECT * FROM settings WHERE id = 1;").fetchone() or {})
            conn.close()

            if fmt == 'csv':
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv')
                self.send_header('Content-Disposition', 'attachment; filename="budget_export.csv"')
                self.end_headers()
                csv_lines = ["id,date,type,category_id,description,amount_minor,amount_inr"]
                for t in txns:
                    inr = t['amount_minor'] / 100.0
                    csv_lines.append(f"{t['id']},{t['date']},{t['type']},{t['category_id']},\"{t.get('description','')}\",{t['amount_minor']},{inr:.2f}")
                self.wfile.write("\n".join(csv_lines).encode('utf-8'))
                return
            else:
                self.send_json(200, {
                    "data": {
                        "settings": settings_row,
                        "categories": cats,
                        "transactions": txns,
                        "exportedAt": datetime.utcnow().isoformat() + "Z"
                    }
                })
                return

        # Otherwise serve static frontend file
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Auth Login: POST /api/v1/auth/login
        if path == '/api/v1/auth/login':
            body = self.read_json_body()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            conn = get_db()
            user = conn.execute("SELECT id, name, email, avatar FROM users WHERE LOWER(email) = ? AND password = ?;", (email, password)).fetchone()
            conn.close()
            if user:
                self.send_json(200, {"data": dict(user)})
            else:
                self.send_api_error(401, "INVALID_CREDENTIALS", "Invalid email or password.")
            return

        # Auth Register: POST /api/v1/auth/register
        if path == '/api/v1/auth/register':
            body = self.read_json_body()
            name = (body.get('name') or '').strip()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            if not name or not email or len(password) < 4:
                self.send_api_error(400, "VALIDATION_ERROR", "Name, email, and password (min 4 chars) are required.")
                return

            user_id = f"user_{int(datetime.utcnow().timestamp()*1000)}"
            avatar = "".join([part[0].upper() for part in name.split()[:2]]) or "U"
            created_at = datetime.utcnow().isoformat() + "Z"
            conn = get_db()
            try:
                conn.execute("INSERT INTO users (id, name, email, password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?);",
                             (user_id, name, email, password, avatar, created_at))
                conn.commit()
                conn.close()
                self.send_json(201, {"data": {"id": user_id, "name": name, "email": email, "avatar": avatar}})
            except sqlite3.IntegrityError:
                conn.close()
                self.send_api_error(409, "USER_EXISTS", "A user with this email already exists.")
            return

        # Salary Update / Set: POST /api/v1/salary
        if path == '/api/v1/salary':
            body = self.read_json_body()
            month = body.get('month', '2026-10')
            amount_minor = body.get('amountMinor')
            desc = body.get('description', 'Monthly salary')
            if not amount_minor or amount_minor <= 0:
                self.send_api_error(400, "VALIDATION_ERROR", "Salary amount must be greater than zero.")
                return

            conn = get_db()
            cur = conn.cursor()
            existing = cur.execute("SELECT id FROM transactions WHERE date LIKE ? AND category_id = 'salary' AND type = 'income';", (f"{month}%",)).fetchone()
            if existing:
                tx_id = existing['id']
                cur.execute("UPDATE transactions SET amount_minor = ?, description = ?, updated_at = datetime('now') WHERE id = ?;", (amount_minor, desc, tx_id))
            else:
                tx_id = f"txn_sal_{int(datetime.utcnow().timestamp()*1000)}"
                cur.execute("INSERT INTO transactions (id, date, description, category_id, type, amount_minor, created_at) VALUES (?, ?, ?, 'salary', 'income', ?, datetime('now'));",
                            (tx_id, f"{month}-01", desc, amount_minor))
            conn.commit()
            conn.close()
            self.send_json(200, {"data": {"id": tx_id, "amountMinor": amount_minor, "month": month, "description": desc}})
            return

        # Create Transaction: POST /api/v1/transactions
        if path == '/api/v1/transactions':
            body = self.read_json_body()
            # Validation
            amount_minor = body.get('amountMinor')
            tx_type = body.get('type')
            category_id = body.get('categoryId')
            date_str = body.get('date')
            description = (body.get('description') or '').strip()

            details = []
            if not amount_minor or not isinstance(amount_minor, int) or amount_minor <= 0:
                details.append({"field": "amountMinor", "message": "Must be an integer greater than zero."})
            if tx_type not in ('income', 'expense'):
                details.append({"field": "type", "message": "Type must be income or expense."})
            if not category_id:
                details.append({"field": "categoryId", "message": "Category ID is required."})
            if not date_str or not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                details.append({"field": "date", "message": "Date must be YYYY-MM-DD."})

            if details:
                self.send_api_error(400, "VALIDATION_ERROR", "Check the highlighted fields.", details)
                return

            tx_id = body.get('id') or f"txn_{int(datetime.utcnow().timestamp()*1000)}"
            created_at = datetime.utcnow().isoformat() + "Z"

            conn = get_db()
            conn.execute("""
            INSERT OR REPLACE INTO transactions (id, date, description, category_id, type, amount_minor, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (tx_id, date_str, description, category_id, tx_type, amount_minor, created_at))
            conn.commit()
            conn.close()

            self.send_json(201, {
                "data": {
                    "id": tx_id,
                    "date": date_str,
                    "description": description,
                    "categoryId": category_id,
                    "type": tx_type,
                    "amountMinor": amount_minor,
                    "createdAt": created_at
                }
            })
            return

        # Create Category: POST /api/v1/categories
        if path == '/api/v1/categories':
            body = self.read_json_body()
            cat_id = (body.get('id') or '').strip().lower()
            name = (body.get('name') or '').strip()
            cat_type = body.get('type', 'expense')
            icon = body.get('icon', '🏷️')
            color = body.get('color', '#64748B')

            if not cat_id or not name:
                self.send_api_error(400, "VALIDATION_ERROR", "Category ID and name are required.")
                return

            conn = get_db()
            try:
                conn.execute("INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?);",
                             (cat_id, name, cat_type, icon, color))
                conn.commit()
                conn.close()
                self.send_json(201, {"data": {"id": cat_id, "name": name, "type": cat_type, "icon": icon, "color": color}})
            except sqlite3.IntegrityError:
                conn.close()
                self.send_api_error(409, "CATEGORY_EXISTS", f"Category '{cat_id}' already exists.")
            return

        # Reset DB to reference seed: POST /api/v1/db/reset
        if path == '/api/v1/db/reset':
            conn = get_db()
            cur = conn.cursor()
            cur.execute("DELETE FROM transactions;")
            cur.execute("DELETE FROM monthly_budgets;")
            cur.execute("DELETE FROM category_budgets;")
            cur.execute("DELETE FROM categories;")
            cur.execute("DELETE FROM settings;")
            cur.execute("DELETE FROM users;")
            conn.commit()
            conn.close()
            init_db()
            self.send_json(200, {"data": {"reset": True, "message": "SQLite database reset to October 2026 reference seed dataset"}})
            return

        # Full Sync from client to SQLite: POST /api/v1/db/sync
        if path == '/api/v1/db/sync':
            body = self.read_json_body()
            txns = body.get('transactions', [])
            settings_obj = body.get('settings', {})
            budgets_obj = body.get('budgets', {})

            conn = get_db()
            cur = conn.cursor()

            # Sync settings if provided
            if settings_obj:
                cur.execute("""
                UPDATE settings
                SET user_name = COALESCE(?, user_name),
                    user_email = COALESCE(?, user_email),
                    currency_code = COALESCE(?, currency_code),
                    currency_symbol = COALESCE(?, currency_symbol),
                    week_start = COALESCE(?, week_start),
                    starting_balance_minor = COALESCE(?, starting_balance_minor),
                    updated_at = datetime('now')
                WHERE id = 1;
                """, (
                    settings_obj.get('userName'),
                    settings_obj.get('userEmail'),
                    settings_obj.get('currencyCode'),
                    settings_obj.get('currencySymbol'),
                    settings_obj.get('weekStart'),
                    settings_obj.get('startingBalanceMinor')
                ))

            # Sync transactions (upsert)
            for tx in txns:
                tx_id = tx.get('id')
                if not tx_id:
                    continue
                cur.execute("""
                INSERT INTO transactions (id, date, description, category_id, type, amount_minor, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    date = excluded.date,
                    description = excluded.description,
                    category_id = excluded.category_id,
                    type = excluded.type,
                    amount_minor = excluded.amount_minor,
                    updated_at = datetime('now');
                """, (
                    tx_id,
                    tx.get('date'),
                    tx.get('description'),
                    tx.get('categoryId'),
                    tx.get('type'),
                    tx.get('amountMinor', 0),
                    tx.get('createdAt', datetime.utcnow().isoformat() + 'Z')
                ))

            # Sync monthly budget
            for month_key, b_data in budgets_obj.items():
                mb_amt = b_data.get('monthlyBudgetMinor', 5000000)
                cur.execute("""
                INSERT INTO monthly_budgets (month, amount_minor, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(month) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = datetime('now');
                """, (month_key, mb_amt))

                cat_limits = b_data.get('categories', {})
                for cat_id, c_amt in cat_limits.items():
                    cur.execute("""
                    INSERT INTO category_budgets (month, category_id, amount_minor, updated_at)
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(month, category_id) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = datetime('now');
                    """, (month_key, cat_id, c_amt))

            conn.commit()
            conn.close()
            self.send_json(200, {"data": {"synced": True, "transactionCount": len(txns)}})
            return

        self.send_api_error(404, "NOT_FOUND", "Endpoint not found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Update Transaction: PUT /api/v1/transactions/:id
        tx_match = re.match(r'^/api/v1/transactions/([^/]+)$', path)
        if tx_match:
            tx_id = tx_match.group(1)
            body = self.read_json_body()
            amount_minor = body.get('amountMinor')
            tx_type = body.get('type')
            category_id = body.get('categoryId')
            date_str = body.get('date')
            description = (body.get('description') or '').strip()

            conn = get_db()
            cur = conn.cursor()
            cur.execute("""
            UPDATE transactions
            SET date = COALESCE(?, date),
                description = COALESCE(?, description),
                category_id = COALESCE(?, category_id),
                type = COALESCE(?, type),
                amount_minor = COALESCE(?, amount_minor),
                updated_at = datetime('now')
            WHERE id = ?;
            """, (date_str, description, category_id, tx_type, amount_minor, tx_id))
            updated = cur.rowcount > 0
            conn.commit()
            conn.close()

            if updated:
                self.send_json(200, {"data": {"id": tx_id, "updated": True}})
            else:
                self.send_api_error(404, "NOT_FOUND", f"Transaction '{tx_id}' not found")
            return

        # Update Category Budget: PUT /api/v1/budgets/:month/categories/:id
        cat_budget_match = re.match(r'^/api/v1/budgets/(\d{4}-\d{2})/categories/([^/]+)$', path)
        if cat_budget_match:
            month = cat_budget_match.group(1)
            category_id = cat_budget_match.group(2)
            body = self.read_json_body()
            amount_minor = body.get('amountMinor', 0)

            conn = get_db()
            conn.execute("""
            INSERT INTO category_budgets (month, category_id, amount_minor, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(month, category_id) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = datetime('now');
            """, (month, category_id, amount_minor))
            conn.commit()
            conn.close()
            self.send_json(200, {"data": {"month": month, "categoryId": category_id, "amountMinor": amount_minor}})
            return

        # Update Monthly Budget: PUT /api/v1/budgets/:month
        budget_match = re.match(r'^/api/v1/budgets/(\d{4}-\d{2})$', path)
        if budget_match:
            month = budget_match.group(1)
            body = self.read_json_body()
            amount_minor = body.get('amountMinor')
            if amount_minor is None or amount_minor < 0:
                self.send_api_error(400, "VALIDATION_ERROR", "amountMinor must be a positive integer.")
                return

            conn = get_db()
            conn.execute("""
            INSERT INTO monthly_budgets (month, amount_minor, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(month) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = datetime('now');
            """, (month, amount_minor))
            conn.commit()
            conn.close()
            self.send_json(200, {"data": {"month": month, "monthlyBudgetMinor": amount_minor}})
            return

        # Update Settings: PUT /api/v1/settings
        if path == '/api/v1/settings':
            body = self.read_json_body()
            user_name = body.get('userName')
            user_email = body.get('userEmail')
            currency_code = body.get('currencyCode')
            currency_symbol = body.get('currencySymbol')
            week_start = body.get('weekStart')
            starting_balance_minor = body.get('startingBalanceMinor')

            conn = get_db()
            cur = conn.cursor()
            cur.execute("""
            UPDATE settings
            SET user_name = COALESCE(?, user_name),
                user_email = COALESCE(?, user_email),
                currency_code = COALESCE(?, currency_code),
                currency_symbol = COALESCE(?, currency_symbol),
                week_start = COALESCE(?, week_start),
                starting_balance_minor = COALESCE(?, starting_balance_minor),
                updated_at = datetime('now')
            WHERE id = 1;
            """, (user_name, user_email, currency_code, currency_symbol, week_start, starting_balance_minor))
            conn.commit()
            row = cur.execute("SELECT * FROM settings WHERE id = 1;").fetchone()
            conn.close()

            d = dict(row)
            self.send_json(200, {"data": {
                "id": d.get('id', 1),
                "userName": d.get('user_name'),
                "userEmail": d.get('user_email'),
                "currencyCode": d.get('currency_code'),
                "currencySymbol": d.get('currency_symbol'),
                "weekStart": d.get('week_start'),
                "startingBalanceMinor": d.get('starting_balance_minor', 5000000),
                "updatedAt": d.get('updated_at')
            }})
            return

        self.send_api_error(404, "NOT_FOUND", "Endpoint not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Delete transaction: DELETE /api/v1/transactions/:id
        tx_match = re.match(r'^/api/v1/transactions/([^/]+)$', path)
        if tx_match:
            tx_id = tx_match.group(1)
            conn = get_db()
            cur = conn.cursor()
            cur.execute("DELETE FROM transactions WHERE id = ?;", (tx_id,))
            deleted = cur.rowcount > 0
            conn.commit()
            conn.close()

            if deleted:
                self.send_json(200, {"data": {"id": tx_id, "deleted": True}})
            else:
                self.send_api_error(404, "NOT_FOUND", f"Transaction '{tx_id}' not found")
            return

        # Delete/Archive Category: DELETE /api/v1/categories/:id
        cat_match = re.match(r'^/api/v1/categories/([^/]+)$', path)
        if cat_match:
            cat_id = cat_match.group(1)
            conn = get_db()
            cur = conn.cursor()
            cur.execute("DELETE FROM categories WHERE id = ?;", (cat_id,))
            deleted = cur.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                self.send_json(200, {"data": {"id": cat_id, "deleted": True}})
            else:
                self.send_api_error(404, "NOT_FOUND", f"Category '{cat_id}' not found")
            return

        self.send_api_error(404, "NOT_FOUND", "Endpoint not found")

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    init_db()
    server = HTTPServer(('127.0.0.1', PORT), BudgetRequestHandler)
    print(f"🚀 Personal Budget Planner server active at: http://127.0.0.1:{PORT}")
    print(f"📁 SQLite database connected at: {DB_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()

if __name__ == '__main__':
    main()
