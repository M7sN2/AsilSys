// Professional Calculator
class Calculator {
    constructor() {
        this.currentInput = '0';
        this.previousInput = null;
        this.operation = null;
        this.shouldResetScreen = false;
        this.history = [];
        
        this.screen = document.getElementById('calcScreen');
        this.historyEl = document.getElementById('calcHistory');
        this.buttons = document.querySelectorAll('.calc-btn');
        
        this.init();
    }
    
    init() {
        this.buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const btn = e.target;
                const value = btn.getAttribute('data-value');
                const action = btn.getAttribute('data-action');
                
                if (value) {
                    this.handleNumber(value);
                } else if (action) {
                    this.handleAction(action);
                }
            });
        });
        
        // Keyboard support
        const self = this;
        document.addEventListener('keydown', (e) => {
            // Only handle keyboard events if calculator is visible
            if (document.getElementById('calcScreen')) {
                self.handleKeyboard(e);
            }
        });
    }
    
    handleNumber(value) {
        if (this.shouldResetScreen) {
            this.currentInput = value;
            this.shouldResetScreen = false;
        } else {
            if (value === '.' && this.currentInput.includes('.')) {
                return; // Prevent multiple decimal points
            }
            this.currentInput = this.currentInput === '0' ? value : this.currentInput + value;
        }
        this.updateDisplay();
    }
    
    handleAction(action) {
        switch (action) {
            case 'clear':
                this.clear();
                break;
            case 'clearEntry':
                this.clearEntry();
                break;
            case 'delete':
                this.delete();
                break;
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
                this.handleOperation(action);
                break;
            case 'equals':
                this.calculate();
                break;
        }
    }
    
    handleOperation(op) {
        if (this.previousInput !== null && !this.shouldResetScreen) {
            this.calculate();
        }
        
        this.operation = op;
        this.previousInput = this.currentInput;
        this.shouldResetScreen = true;
        
        this.updateHistory();
    }
    
    calculate() {
        if (this.previousInput === null || this.operation === null) {
            return;
        }
        
        const prev = parseFloat(this.previousInput);
        const current = parseFloat(this.currentInput);
        let result;
        
        switch (this.operation) {
            case 'add':
                result = prev + current;
                break;
            case 'subtract':
                result = prev - current;
                break;
            case 'multiply':
                result = prev * current;
                break;
            case 'divide':
                if (current === 0) {
                    this.currentInput = 'خطأ';
                    this.previousInput = null;
                    this.operation = null;
                    this.updateDisplay();
                    setTimeout(() => {
                        this.clear();
                    }, 2000);
                    return;
                }
                result = prev / current;
                break;
            default:
                return;
        }
        
        // Format result to avoid floating point errors
        result = this.formatResult(result);
        
        // Add to history
        const expression = `${this.previousInput} ${this.getOperationSymbol(this.operation)} ${this.currentInput} = ${result}`;
        this.history.unshift(expression);
        if (this.history.length > 5) {
            this.history.pop();
        }
        
        this.currentInput = result.toString();
        this.previousInput = null;
        this.operation = null;
        this.shouldResetScreen = true;
        
        this.updateDisplay();
        this.updateHistory();
    }
    
    formatResult(num) {
        // Round to 10 decimal places to avoid floating point errors
        return Math.round((num + Number.EPSILON) * 10000000000) / 10000000000;
    }
    
    getOperationSymbol(op) {
        const symbols = {
            'add': '+',
            'subtract': '−',
            'multiply': '×',
            'divide': '÷'
        };
        return symbols[op] || '';
    }
    
    clear() {
        this.currentInput = '0';
        this.previousInput = null;
        this.operation = null;
        this.shouldResetScreen = false;
        this.updateDisplay();
        this.historyEl.textContent = '';
    }
    
    clearEntry() {
        this.currentInput = '0';
        this.updateDisplay();
    }
    
    delete() {
        if (this.currentInput.length > 1) {
            this.currentInput = this.currentInput.slice(0, -1);
        } else {
            this.currentInput = '0';
        }
        this.updateDisplay();
    }
    
    updateDisplay() {
        // Format number with commas for thousands
        let displayValue = this.currentInput;
        if (displayValue !== 'خطأ' && !displayValue.includes('.')) {
            const num = parseFloat(displayValue);
            if (!isNaN(num)) {
                displayValue = num.toLocaleString('ar-EG');
            }
        }
        this.screen.textContent = displayValue;
    }
    
    updateHistory() {
        if (this.operation && this.previousInput !== null) {
            const symbol = this.getOperationSymbol(this.operation);
            this.historyEl.textContent = `${this.formatNumber(this.previousInput)} ${symbol}`;
        } else {
            this.historyEl.textContent = '';
        }
    }
    
    formatNumber(num) {
        if (num === null || num === undefined) return '';
        const str = num.toString();
        if (!str.includes('.')) {
            return parseFloat(str).toLocaleString('ar-EG');
        }
        return str;
    }
    
    handleKeyboard(e) {
        const key = e.key;
        
        // Only prevent default for calculator keys
        if ((key >= '0' && key <= '9') || key === '.' || key === '+' || key === '-' || 
            key === '*' || key === '/' || key === 'Enter' || key === '=' || 
            key === 'Escape' || key === 'Backspace') {
            e.preventDefault();
        } else {
            return; // Ignore other keys
        }
        
        // Numbers
        if (key >= '0' && key <= '9') {
            this.handleNumber(key);
        }
        
        // Decimal point
        if (key === '.') {
            this.handleNumber('.');
        }
        
        // Operations
        if (key === '+') {
            this.handleOperation('add');
        } else if (key === '-') {
            this.handleOperation('subtract');
        } else if (key === '*') {
            this.handleOperation('multiply');
        } else if (key === '/') {
            this.handleOperation('divide');
        }
        
        // Equals
        if (key === 'Enter' || key === '=') {
            this.calculate();
        }
        
        // Clear
        if (key === 'Escape') {
            this.clear();
        }
        
        // Backspace
        if (key === 'Backspace') {
            this.delete();
        }
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('calcScreen')) {
        new Calculator();
    }
});

