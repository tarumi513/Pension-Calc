/**
 * 年金手取りシミュレーター - 計算 & UI制御ロジック
 */

// 状態管理
const state = {
    currentAge: 60,
    lifeExpectancy: 85,
    householdType: 'single', // 'single' | 'couple'
    healthInsuranceType: 'kokubo', // 'kokubo' | 'ninki'
    selectedRegion: 'standard', // 'standard' | 'tokyo' | 'osaka' | ...
    preRetirementIncome: 600, // 万円
    basicPension65: 80, // 万円
    welfarePension65: 120, // 万円
    postRetirementWorkIncome: 0, // 万円
    selectedStartAge: 65.0, // 60.0 〜 75.0 (月単位換算)
    viewType: 'net', // 'net' (手取り) | 'gross' (額面)
    chart: null
};

// 地域別地方税・保険料パラメータ
const REGIONAL_PARAMS = {
    standard: {
        kokuboIncomeRate: 0.09,
        kokuboKunto: 4.5,
        kokuboHeigetsu: 2.5,
        residentFlat: 0.5,
        name: '標準（全国平均モデル）'
    },
    tokyo: {
        kokuboIncomeRate: 0.092,
        kokuboKunto: 6.1,
        kokuboHeigetsu: 0.0,
        residentFlat: 0.5,
        name: '東京都23区（新宿区等）'
    },
    osaka: {
        kokuboIncomeRate: 0.125,
        kokuboKunto: 5.6,
        kokuboHeigetsu: 3.1,
        residentFlat: 0.53,
        name: '大阪府大阪市'
    },
    nagoya: {
        kokuboIncomeRate: 0.102,
        kokuboKunto: 5.2,
        kokuboHeigetsu: 0.0,
        residentFlat: 0.45,
        name: '愛知県名古屋市'
    },
    fukuoka: {
        kokuboIncomeRate: 0.118,
        kokuboKunto: 5.8,
        kokuboHeigetsu: 2.4,
        residentFlat: 0.55,
        name: '福岡県福岡市'
    },
    sapporo: {
        kokuboIncomeRate: 0.112,
        kokuboKunto: 5.1,
        kokuboHeigetsu: 2.8,
        residentFlat: 0.60,
        name: '北海道札幌市'
    }
};

// 定数定義
const CONSTANTS = {
    KAIGO_BASE: 7.5, // 介護保険料基準額（年間7.5万円）
    KOKUBO_HEIGETSU: 2.5, // 国保平等割
    KOKUBO_KUNTO: 4.5, // 国保均等割
    KOUKI_KUNTO: 4.5, // 後期高齢均等割
};

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    initAccordions();
    calculateAndRender();
});

// アコーディオンUIの制御
function initAccordions() {
    const triggers = document.querySelectorAll('.accordion-trigger');
    
    triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetId = trigger.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            
            if (!targetContent) return;
            
            const isOpen = targetContent.classList.contains('open');
            
            if (isOpen) {
                targetContent.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                targetContent.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

// UI要素の取得と同期
let elements = {};
function initElements() {
    const ids = [
        'current-age', 'current-age-slider',
        'life-expectancy', 'life-expectancy-slider',
        'household-type', 'health-insurance-type', 'region-select',
        'pre-retirement-income', 'pre-retirement-income-slider',
        'basic-pension', 'welfare-pension',
        'post-retirement-work-income', 'post-retirement-work-income-slider',
        'start-age', 'start-age-display',
        'total-net-income', 'total-gross-income',
        'total-deductions', 'net-ratio',
        'breakeven-result', 'detail-table-body',
        'table-selected-age', 'btn-show-net', 'btn-show-gross', 'average-monthly-net'
    ];
    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

// イベントリスナーの登録
function initEventListeners() {
    // スライダーと数値入力の双方向バインディング
    setupSyncInput('current-age', 'current-age-slider', 'currentAge');
    setupSyncInput('life-expectancy', 'life-expectancy-slider', 'lifeExpectancy');
    setupSyncInput('pre-retirement-income', 'pre-retirement-income-slider', 'preRetirementIncome');
    setupSyncInput('post-retirement-work-income', 'post-retirement-work-income-slider', 'postRetirementWorkIncome');

    // セレクトボックスのバインディング
    elements['household-type'].addEventListener('change', (e) => {
        state.householdType = e.target.value;
        calculateAndRender();
    });
    elements['health-insurance-type'].addEventListener('change', (e) => {
        state.healthInsuranceType = e.target.value;
        calculateAndRender();
    });
    elements['region-select'].addEventListener('change', (e) => {
        state.selectedRegion = e.target.value;
        calculateAndRender();
    });

    // 年金入力のバインディング
    elements['basic-pension'].addEventListener('input', (e) => {
        state.basicPension65 = Math.max(0, parseFloat(e.target.value) || 0);
        calculateAndRender();
    });
    elements['welfare-pension'].addEventListener('input', (e) => {
        state.welfarePension65 = Math.max(0, parseFloat(e.target.value) || 0);
        calculateAndRender();
    });

    // 検討する受給開始年齢スライダー（値は720〜900ヶ月の整数）
    elements['start-age'].addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        
        const years = Math.floor(val / 12);
        const months = val % 12;
        
        state.selectedStartAge = val / 12;
        elements['start-age-display'].textContent = `${years}歳 ${months}ヶ月`;
        
        calculateAndRender();
    });

    // 表示切り替えボタン
    elements['btn-show-net'].addEventListener('click', () => {
        state.viewType = 'net';
        elements['btn-show-net'].classList.add('active');
        elements['btn-show-gross'].classList.remove('active');
        calculateAndRender();
    });
    elements['btn-show-gross'].addEventListener('click', () => {
        state.viewType = 'gross';
        elements['btn-show-gross'].classList.add('active');
        elements['btn-show-net'].classList.remove('active');
        calculateAndRender();
    });
}

// 双方向バインディングのヘルパー
function setupSyncInput(numId, sliderId, stateKey) {
    const numInput = elements[numId];
    const sliderInput = elements[sliderId];

    numInput.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value) || 0;
        val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
        sliderInput.value = val;
        state[stateKey] = val;
        calculateAndRender();
    });

    sliderInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        numInput.value = val;
        state[stateKey] = val;
        calculateAndRender();
    });
}

// ----------------------------------------------------
// 計算ロジック
// ----------------------------------------------------

/**
 * 繰り上げ・繰り下げ増減率の計算
 * 基準：65歳
 * 繰り上げ（60〜65歳未満）：1ヶ月あたり -0.4%
 * 繰り下げ（66〜75歳）：1ヶ月あたり +0.7% (65歳〜66歳未満は増額なし)
 */
function getPensionRate(startAge) {
    if (startAge === 65.0) return 1.0;
    
    if (startAge < 65.0) {
        const months = Math.round((65.0 - startAge) * 12);
        return 1.0 - (months * 0.004); // -0.4% per month
    } else {
        if (startAge < 66.0) return 1.0; // 65歳台の繰り下げ増額は、66歳に達するまで適用されない（日本のルール）
        const months = Math.round((startAge - 65.0) * 12);
        return 1.0 + (months * 0.007); // +0.7% per month
    }
}

/**
 * 公的年金等控除の計算（雑所得算出）
 * 65歳未満と65歳以上で異なるテーブル
 */
function getPensionDeduction(pensionAmount, age) {
    if (pensionAmount <= 0) return 0;
    
    if (age < 65) {
        // 65歳未満
        if (pensionAmount <= 130) {
            return 60;
        } else if (pensionAmount <= 410) {
            return pensionAmount * 0.25 + 27.5;
        } else if (pensionAmount <= 770) {
            return pensionAmount * 0.15 + 68.5;
        } else {
            return pensionAmount * 0.05 + 145.5;
        }
    } else {
        // 65歳以上
        if (pensionAmount <= 330) {
            return 110;
        } else if (pensionAmount <= 410) {
            return pensionAmount * 0.25 + 27.5;
        } else if (pensionAmount <= 770) {
            return pensionAmount * 0.15 + 68.5;
        } else {
            return pensionAmount * 0.05 + 145.5;
        }
    }
}

/**
 * 給与所得控除（その他収入が給与と想定）
 */
function getSalaryIncome(grossSalary) {
    if (grossSalary <= 0) return 0;
    
    let deduction = 0;
    if (grossSalary <= 55) {
        deduction = grossSalary;
    } else if (grossSalary <= 162.5) {
        deduction = 55;
    } else if (grossSalary <= 180) {
        deduction = grossSalary * 0.4 - 10;
    } else if (grossSalary <= 360) {
        deduction = grossSalary * 0.3 + 8;
    } else if (grossSalary <= 660) {
        deduction = grossSalary * 0.2 + 44;
    } else if (grossSalary <= 850) {
        deduction = grossSalary * 0.1 + 110;
    } else {
        deduction = 195;
    }
    return Math.max(0, grossSalary - deduction);
}

/**
 * 所得税・住民税の計算
 */
function calculateTaxes(pensionGross, otherGross, age, totalSocialInsurance, householdType) {
    const pensionIncome = Math.max(0, pensionGross - getPensionDeduction(pensionGross, age));
    const salaryIncome = getSalaryIncome(otherGross);
    const totalIncome = pensionIncome + salaryIncome;
    
    // 扶養人数
    const dependentCount = householdType === 'couple' ? 1 : 0;
    
    // 所得税計算
    const basicDeductionIT = 48; // 基礎控除 48万円
    const spouseDeductionIT = dependentCount > 0 ? 38 : 0; // 配偶者控除 38万円
    const deductionsIT = totalSocialInsurance + basicDeductionIT + spouseDeductionIT;
    const taxableIncomeIT = Math.max(0, totalIncome - deductionsIT);
    
    let baseIncomeTax = 0;
    if (taxableIncomeIT <= 195) {
        baseIncomeTax = taxableIncomeIT * 0.05;
    } else if (taxableIncomeIT <= 330) {
        baseIncomeTax = taxableIncomeIT * 0.10 - 9.75;
    } else if (taxableIncomeIT <= 695) {
        baseIncomeTax = taxableIncomeIT * 0.20 - 42.75;
    } else if (taxableIncomeIT <= 900) {
        baseIncomeTax = taxableIncomeIT * 0.23 - 63.60;
    } else if (taxableIncomeIT <= 1800) {
        baseIncomeTax = taxableIncomeIT * 0.33 - 153.60;
    } else {
        baseIncomeTax = taxableIncomeIT * 0.40 - 279.60;
    }
    const totalIncomeTax = baseIncomeTax * 1.021; // 復興特別所得税 2.1%加算
    
    // 住民税計算
    // 住民税非課税世帯判定
    let isResidentTaxFree = false;
    if (householdType === 'single') {
        if (totalIncome <= 45.0) isResidentTaxFree = true; // 単身 45万円(自治体により45.5万)
    } else {
        if (totalIncome <= 101.0) isResidentTaxFree = true; // 夫婦扶養1 101万円
    }
    
    let totalResidentTax = 0;
    if (!isResidentTaxFree) {
        const basicDeductionRT = 43; // 基礎控除 43万円
        const spouseDeductionRT = dependentCount > 0 ? 33 : 0; // 配偶者控除 33万円
        const deductionsRT = totalSocialInsurance + basicDeductionRT + spouseDeductionRT;
        const taxableIncomeRT = Math.max(0, totalIncome - deductionsRT);
        
        const incomePart = taxableIncomeRT * 0.10; // 一律 10%
        const regParams = REGIONAL_PARAMS[state.selectedRegion] || REGIONAL_PARAMS.standard;
        const flatPart = regParams.residentFlat;
        totalResidentTax = incomePart + flatPart;
    }
    
    return {
        incomeTax: Math.round(totalIncomeTax * 10) / 10,
        residentTax: Math.round(totalResidentTax * 10) / 10,
        isNonTaxable: isResidentTaxFree
    };
}

/**
 * 社会保険料の計算
 */
function calculateSocialInsurance(preYearPension, preYearOther, age, householdType, healthInsType) {
    const dependentCount = householdType === 'couple' ? 1 : 0;
    const memberCount = 1 + dependentCount;
    
    // 前年所得
    const preYearPensionIncome = Math.max(0, preYearPension - getPensionDeduction(preYearPension, age - 1));
    const preYearSalaryIncome = getSalaryIncome(preYearOther);
    const preYearTotalIncome = preYearPensionIncome + preYearSalaryIncome;
    
    let healthInsurance = 0;
    let kaigoInsurance = 0;
    let welfarePensionIns = 0; // 60歳未満のみだが、シミュレーションは60歳からのため基本0
    
    // 60〜64歳：国民年金保険料（60歳未満なら必要だが、今回は60歳以上なので任意加入しない限り0）
    
    // --- 1. 健康保険料の計算 ---
    if (age >= 75) {
        // 75歳以上：後期高齢者医療保険
        // 旧ただし書き所得
        const baseIncome = Math.max(0, preYearTotalIncome - 43);
        const incomePart = baseIncome * 0.085; // 所得割率 約8.5%
        
        // 均等割の軽減判定
        let scale = 1.0;
        if (preYearTotalIncome <= 43) {
            scale = 0.3; // 7割軽減
        } else if (preYearTotalIncome <= 43 + 29.5) {
            scale = 0.5; // 5割軽減
        } else if (preYearTotalIncome <= 43 + 53.5) {
            scale = 0.8; // 2割軽減
        }
        const flatPart = CONSTANTS.KOUKI_KUNTO * scale;
        
        healthInsurance = incomePart + flatPart;
        // 後期高齢者医療保険の上限（約66万円〜80万円、自治体・年度による）
        healthInsurance = Math.min(80, healthInsurance);
        
    } else {
        // 60〜74歳：国保 または 任意継続
        if (age < 62 && healthInsType === 'ninki') {
            // 任意継続（上限あり、前年所得に関わらず頭打ち）
            // 平均的な標準報酬月額30万として全額負担率10% ＝ 月3万円、年間36万円。
            // 介護分も含めると月3.5万円、年間42万円程度。
            // ここでは前年年収による本来の健康保険料と、上限36万円（介護除く）の低い方を適用。
            const estimatePremium = Math.min(36, preYearOther * 0.05); // 労使折半なし
            healthInsurance = Math.max(12, estimatePremium);
        } else {
            // 国民健康保険
            const baseIncome = Math.max(0, preYearTotalIncome - 43);
            const regParams = REGIONAL_PARAMS[state.selectedRegion] || REGIONAL_PARAMS.standard;
            const incomePart = baseIncome * regParams.kokuboIncomeRate;
            
            // 均等割・平等割 of 軽減判定
            let scale = 1.0;
            const thresholdIncome = preYearTotalIncome;
            if (thresholdIncome <= 43) {
                scale = 0.3; // 7割軽減
            } else if (thresholdIncome <= 43 + 29.5 * memberCount) {
                scale = 0.5; // 5割軽減
            } else if (thresholdIncome <= 43 + 53.5 * memberCount) {
                scale = 0.8; // 2割軽減
            }
            
            const flatPart = (regParams.kokuboKunto * memberCount + regParams.kokuboHeigetsu) * scale;
            healthInsurance = incomePart + flatPart;
            // 国保上限（医療分＋支援金分で約85万円）
            healthInsurance = Math.min(85, healthInsurance);
        }
    }
    
    // --- 2. 介護保険料の計算（65歳以上） ---
    if (age >= 65) {
        // 本人の合計所得金額に基づき段階決定
        // 全国平均基準額を年額7.5万円とする。
        const base = CONSTANTS.KAIGO_BASE;
        let factor = 1.0;
        
        // 所得区分判定
        if (preYearTotalIncome <= 45) { // 本人非課税（単身基準）
            if (preYearTotalIncome <= 12) {
                factor = 0.3; // 第1段階
            } else if (preYearTotalIncome <= 32) {
                factor = 0.5; // 第2段階
            } else {
                factor = 0.7; // 第3段階
            }
        } else { // 本人課税
            if (preYearTotalIncome <= 120) {
                factor = 1.0; // 第5段階
            } else if (preYearTotalIncome <= 210) {
                factor = 1.2; // 第6段階
            } else if (preYearTotalIncome <= 320) {
                factor = 1.3; // 第7段階
            } else if (preYearTotalIncome <= 420) {
                factor = 1.5; // 第8段階
            } else if (preYearTotalIncome <= 520) {
                factor = 1.7; // 第9段階
            } else if (preYearTotalIncome <= 620) {
                factor = 1.9; // 第10段階
            } else {
                factor = 2.2; // 第11段階〜以上
            }
        }
        
        kaigoInsurance = base * factor;
    } else {
        // 60〜64歳：健康保険料に含まれる（国保または任意継続に含まれるものとする）
        kaigoInsurance = 0;
    }
    
    const total = healthInsurance + kaigoInsurance;
    return {
        health: Math.round(healthInsurance * 10) / 10,
        kaigo: Math.round(kaigoInsurance * 10) / 10,
        total: Math.round(total * 10) / 10
    };
}

/**
 * 特定の受給開始年齢での生涯キャッシュフローをシミュレーション
 */
function runSingleSimulation(startAge) {
    const timeline = [];
    const pensionBase = state.basicPension65 + state.welfarePension65;
    const rate = getPensionRate(startAge);
    const actualPensionYear = pensionBase * rate;
    
    let cumNet = 0;
    let preYearPension = 0;
    let preYearOther = 0;
    
    // シミュレーションは 60歳 から想定寿命（最大100歳）まで
    for (let age = 60; age <= state.lifeExpectancy; age++) {
        // 前年の所得情報の設定
        if (age === 60) {
            preYearPension = 0;
            preYearOther = state.preRetirementIncome; // 現役最終年の年収
        } else {
            // 前年の実績
            const preYearItem = timeline[timeline.length - 1];
            preYearPension = preYearItem.pensionGross;
            preYearOther = preYearItem.otherGross;
        }
        
        // 今年の収入
        // 受給開始年齢（月単位）を過ぎているか
        const hasStarted = age >= startAge;
        const pensionGross = hasStarted ? actualPensionYear : 0;
        
        // その他収入（年金受給中のバイトなど）。60歳以降ずっと続くと仮定。
        const otherGross = state.postRetirementWorkIncome;
        
        // 保険料計算
        const socialIns = calculateSocialInsurance(
            preYearPension,
            preYearOther,
            age,
            state.householdType,
            state.healthInsuranceType
        );
        
        // 税金計算
        const taxes = calculateTaxes(
            pensionGross,
            otherGross,
            age,
            socialIns.total,
            state.householdType
        );
        
        const grossTotal = pensionGross + otherGross;
        const deductionsTotal = taxes.incomeTax + taxes.residentTax + socialIns.total;
        const netIncome = Math.max(0, grossTotal - deductionsTotal);
        
        cumNet += netIncome;
        
        timeline.push({
            age: age,
            pensionGross: pensionGross,
            otherGross: otherGross,
            grossTotal: grossTotal,
            healthIns: socialIns.health,
            kaigoIns: socialIns.kaigo,
            socialInsTotal: socialIns.total,
            incomeTax: taxes.incomeTax,
            residentTax: taxes.residentTax,
            deductionsTotal: deductionsTotal,
            netIncome: netIncome,
            cumNet: cumNet,
            rate: rate,
            hasStarted: hasStarted
        });
    }
    
    return timeline;
}

// ----------------------------------------------------
// UI更新・レンダリング
// ----------------------------------------------------

function calculateAndRender() {
    // 1. 各受給開始年齢でのシミュレーションを実行
    const simSelected = runSingleSimulation(state.selectedStartAge);
    const sim60 = runSingleSimulation(60.0);
    const sim65 = runSingleSimulation(65.0);
    const sim70 = runSingleSimulation(70.0);
    const sim75 = runSingleSimulation(75.0);
    
    // 2. サマリー表示の更新 (選択した開始年齢)
    updateSummary(simSelected);
    
    // 3. 損益分岐点の計算・表示
    updateBreakeven(simSelected, sim65, sim60, sim70, sim75);
    
    // 4. 年次詳細テーブルの更新
    updateDetailTable(simSelected);
    
    // 5. グラフ描画
    renderChart(simSelected, sim65, sim60, sim70, sim75);
}

/**
 * サマリーカードの数値を更新
 */
function updateSummary(timeline) {
    let totalGrossPension = 0;
    let totalNet = 0;
    let totalDeductions = 0;
    
    timeline.forEach(item => {
        totalGrossPension += item.pensionGross;
        totalNet += item.netIncome;
        totalDeductions += item.deductionsTotal;
    });
    
    elements['total-net-income'].textContent = Math.round(totalNet).toLocaleString();
    elements['total-gross-income'].textContent = Math.round(totalGrossPension).toLocaleString();
    elements['total-deductions'].textContent = Math.round(totalDeductions).toLocaleString();
    
    const grossTotal = totalGrossPension + (state.postRetirementWorkIncome * timeline.length);
    const ratio = grossTotal > 0 ? (totalNet / grossTotal) * 100 : 0;
    elements['net-ratio'].textContent = ratio.toFixed(1);
    
    // 受給開始後の平均月額手取りの算出
    const startYears = timeline.filter(item => item.hasStarted);
    const avgNetMonthly = startYears.length > 0 
        ? (startYears.reduce((sum, item) => sum + item.netIncome, 0) / startYears.length) / 12 
        : 0;
    elements['average-monthly-net'].textContent = avgNetMonthly.toFixed(1);
}

/**
 * 損益分岐点分析の表示更新
 */
function updateBreakeven(simSelected, sim65, sim60, sim70, sim75) {
    const container = elements['breakeven-result'];
    container.innerHTML = '';
    
    const targetAge = state.selectedStartAge;
    const totalMonthsTarget = Math.round(targetAge * 12);
    const targetAgeStr = `${Math.floor(totalMonthsTarget / 12)}歳${totalMonthsTarget % 12}ヶ月`;
    
    // 生涯手取り合計の比較
    const getFinalCumNet = (sim) => sim[sim.length - 1].cumNet;
    const netSelected = getFinalCumNet(simSelected);
    const net65 = getFinalCumNet(sim65);
    
    // 差額
    const diff = netSelected - net65;
    const diffStr = diff >= 0 
        ? `<span style="color:var(--accent-green); font-weight:700;">＋${Math.round(diff).toLocaleString()}万円</span>`
        : `<span style="color:var(--text-red); font-weight:700;">－${Math.round(Math.abs(diff)).toLocaleString()}万円</span>`;
        
    let verdictText = '';
    
    if (Math.abs(targetAge - 65.0) < 0.01) {
        verdictText = `現在、基準となる <strong>65歳0ヶ月受給開始</strong> を選択しています。他の開始年齢（スライダー）に変更すると、65歳開始時との生涯累計手取りの損益分岐点が表示されます。`;
    } else {
        // 交差年齢の算出
        let crossoverAge = null;
        
        if (targetAge > 65.0) {
            // 繰り下げ受給の場合：最初は65歳開始がリードし、後から繰り下げ開始が追い抜く
            for (let i = 0; i < simSelected.length; i++) {
                if (simSelected[i].cumNet > sim65[i].cumNet) {
                    crossoverAge = simSelected[i].age;
                    break;
                }
            }
            if (crossoverAge) {
                verdictText = `繰り下げ受給（${targetAgeStr}）を選択した場合、65歳開始と比較して、<strong>${crossoverAge}歳で累積手取り額が逆転</strong>します。これより長生きすると、繰り下げ受給の方が手取りベースでお得になります。想定寿命（${state.lifeExpectancy}歳）時点では、65歳開始より生涯で ${diffStr} 手取りが多くなります。`;
            } else {
                verdictText = `繰り下げ受給（${targetAgeStr}）を選択した場合、65歳開始を追い抜くのは<strong>${state.lifeExpectancy}歳より後（想定寿命を超える年齢）</strong>となります。想定寿命（${state.lifeExpectancy}歳）時点では、65歳開始より生涯で ${diffStr} 手取りが少なくなります。`;
            }
        } else {
            // 繰り上げ受給の場合：最初は繰り上げ（60歳等）がリードするが、後から65歳開始が追い抜く
            for (let i = 0; i < simSelected.length; i++) {
                if (sim65[i].cumNet > simSelected[i].cumNet) {
                    crossoverAge = sim65[i].age;
                    break;
                }
            }
            if (crossoverAge) {
                verdictText = `繰り上げ受給（${targetAgeStr}）を選択した場合、65歳開始に<strong>${crossoverAge}歳で手取り累計額が追い抜かれます</strong>。これより長生きする場合は、65歳開始（あるいはそれ以降）の方が有利です。想定寿命（${state.lifeExpectancy}歳）時点では、65歳開始より生涯で ${diffStr} 手取りが少なくなります。`;
            } else {
                verdictText = `繰り上げ受給（${targetAgeStr}）を選択した場合、想定寿命（${state.lifeExpectancy}歳）に達するまで65歳開始に追い抜かれません。想定寿命時点では生涯で ${diffStr} 手取りが多くなります。`;
            }
        }
    }
    
    // 主要開始年齢の生涯手取り額カード
    const cardHtml = `
        <div class="breakeven-verdict">
            ${verdictText}
        </div>
        <div class="breakeven-grid">
            <div class="breakeven-card ${Math.abs(targetAge - 60.0) < 0.1 ? 'winner' : ''}">
                <span class="breakeven-card-title">60歳受給開始 (繰り上げ)</span>
                <span class="breakeven-card-value">${Math.round(getFinalCumNet(sim60)).toLocaleString()}万円</span>
                <span class="breakeven-card-desc">65歳比: ${Math.round(getFinalCumNet(sim60) - net65).toLocaleString()}万円</span>
            </div>
            <div class="breakeven-card ${Math.abs(targetAge - 65.0) < 0.1 ? 'winner' : ''}">
                <span class="breakeven-card-title">65歳受給開始 (基準)</span>
                <span class="breakeven-card-value">${Math.round(net65).toLocaleString()}万円</span>
                <span class="breakeven-card-desc">基準値</span>
            </div>
            <div class="breakeven-card ${Math.abs(targetAge - 70.0) < 0.1 ? 'winner' : ''}">
                <span class="breakeven-card-title">70歳受給開始 (繰り下げ)</span>
                <span class="breakeven-card-value">${Math.round(getFinalCumNet(sim70)).toLocaleString()}万円</span>
                <span class="breakeven-card-desc">65歳比: ${Math.round(getFinalCumNet(sim70) - net65).toLocaleString()}万円</span>
            </div>
            <div class="breakeven-card ${Math.abs(targetAge - 75.0) < 0.1 ? 'winner' : ''}">
                <span class="breakeven-card-title">75歳受給開始 (繰り下げ)</span>
                <span class="breakeven-card-value">${Math.round(getFinalCumNet(sim75)).toLocaleString()}万円</span>
                <span class="breakeven-card-desc">65歳比: ${Math.round(getFinalCumNet(sim75) - net65).toLocaleString()}万円</span>
            </div>
        </div>
    `;
    
    container.innerHTML = cardHtml;
}

/**
 * 詳細テーブルの更新
 */
function updateDetailTable(timeline) {
    const tbody = elements['detail-table-body'];
    tbody.innerHTML = '';
    
    const totalMonthsDetail = Math.round(state.selectedStartAge * 12);
    const years = Math.floor(totalMonthsDetail / 12);
    const months = totalMonthsDetail % 12;
    elements['table-selected-age'].textContent = `${years}歳${months}ヶ月`;
    
    timeline.forEach(item => {
        const tr = document.createElement('tr');
        
        // 年金受給開始年の行をハイライト
        const isStartYear = item.age === years;
        if (isStartYear) {
            tr.classList.add('receive-start');
        }
        
        // 前年収入(前年実績)の表示
        let preYearIncomeStr = '-';
        if (item.age === 60) {
            preYearIncomeStr = `${state.preRetirementIncome}万円 (現役年収)`;
        } else {
            // 前年の年金＋その他収入
            const prePension = item.age - 1 >= Math.floor(state.selectedStartAge) ? (timeline[item.age - 60 - 1].pensionGross) : 0;
            const preOther = state.postRetirementWorkIncome;
            preYearIncomeStr = `${Math.round(prePension + preOther)}万円`;
        }
        
        const monthlyNetStr = item.netIncome > 0 
            ? `<span style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary); display: block;">(月 ${Math.round(item.netIncome / 12 * 10) / 10}万)</span>` 
            : '';

        tr.innerHTML = `
            <td style="font-weight:600; text-align:center;">${item.age}歳</td>
            <td style="font-size: 0.8rem; color: var(--text-secondary);">${preYearIncomeStr}</td>
            <td>${Math.round(item.pensionGross).toLocaleString()}万円</td>
            <td>${item.otherGross > 0 ? Math.round(item.otherGross).toLocaleString() + '万円' : '-'}</td>
            <td style="color:#e2e8f0;">${item.incomeTax > 0 ? Math.round(item.incomeTax).toLocaleString() + '万円' : '-'}</td>
            <td style="color:#e2e8f0;">${item.residentTax > 0 ? Math.round(item.residentTax).toLocaleString() + '万円' : '-'}</td>
            <td style="color:#cbd5e1;">${item.socialInsTotal > 0 ? Math.round(item.socialInsTotal).toLocaleString() + '万円' : '-'}</td>
            <td class="highlight-td">${Math.round(item.netIncome).toLocaleString()}万円${monthlyNetStr}</td>
            <td style="font-weight:600; background:rgba(255,255,255,0.015);">${Math.round(item.cumNet).toLocaleString()}万円</td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Chart.jsによる生涯累積グラフのレンダリング
 */
function renderChart(simSelected, sim65, sim60, sim70, sim75) {
    const ctx = document.getElementById('incomeChart').getContext('2d');
    
    const ages = simSelected.map(item => `${item.age}歳`);
    
    // 表示データの取得 (手取り or 額面)
    const getDataProperty = (item) => {
        if (state.viewType === 'net') {
            return item.cumNet;
        } else {
            // 額面の累積
            // 年金額面の累積 ＋ ワーク収入の累積
            const index = simSelected.indexOf(item);
            let cumGross = 0;
            const sim = simSelected; // 同じインデックスのシミュレーション結果
            // 対象シミュレーションの配列から累計を出す
            return 0; // 後でシミュレーション別に計算
        }
    };
    
    const getCumGrossData = (sim) => {
        let cum = 0;
        return sim.map(item => {
            cum += item.pensionGross + item.otherGross;
            return cum;
        });
    };
    
    const getCumNetData = (sim) => {
        return sim.map(item => item.cumNet);
    };
    
    const selectedData = state.viewType === 'net' ? getCumNetData(simSelected) : getCumGrossData(simSelected);
    const data60 = state.viewType === 'net' ? getCumNetData(sim60) : getCumGrossData(sim60);
    const data65 = state.viewType === 'net' ? getCumNetData(sim65) : getCumGrossData(sim65);
    const data70 = state.viewType === 'net' ? getCumNetData(sim70) : getCumGrossData(sim70);
    const data75 = state.viewType === 'net' ? getCumNetData(sim75) : getCumGrossData(sim75);
    
    const targetAge = state.selectedStartAge;
    const totalMonthsChart = Math.round(targetAge * 12);
    const years = Math.floor(totalMonthsChart / 12);
    const months = totalMonthsChart % 12;
    const selectedLabel = `検討中: ${years}歳${months}ヶ月開始`;
    
    // 既存のチャートがあれば破棄
    if (state.chart) {
        state.chart.destroy();
    }
    
    // グラフ描画オプション
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ages,
            datasets: [
                {
                    label: selectedLabel,
                    data: selectedData,
                    borderColor: '#06b6d4', // シアン
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    zIndex: 10
                },
                {
                    label: '60歳受給開始',
                    data: data60,
                    borderColor: 'rgba(236, 72, 153, 0.4)', // ピンク半透明
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                    borderDash: [4, 4]
                },
                {
                    label: '65歳受給開始 (基準)',
                    data: data65,
                    borderColor: 'rgba(99, 102, 241, 0.7)', // インディゴ
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: '70歳受給開始',
                    data: data70,
                    borderColor: 'rgba(16, 185, 129, 0.4)', // グリーン半透明
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                    borderDash: [4, 4]
                },
                {
                    label: '75歳受給開始',
                    data: data75,
                    borderColor: 'rgba(245, 158, 11, 0.4)', // アンバー半透明
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                    borderDash: [4, 4]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: {
                            family: 'Inter, sans-serif'
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += Math.round(context.parsed.y).toLocaleString() + '万円';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return value.toLocaleString() + '万';
                        }
                    }
                }
            }
        }
    });
}
