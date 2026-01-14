import { evaluate, format, MathType, create, all } from 'mathjs';
import { Textarea } from "@/components/ui/textarea";
import { useState } from 'react';
import { Configs } from '@/conf';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

// 创建高精度 mathjs 实例
// 使用 mathjs 的 create 函数创建一个新的 mathjs 实例
// all: 包含所有 mathjs 功能的预设
// 配置选项:
// - number: 'BigNumber': 使用 BigNumber 类型进行高精度计算，避免 JavaScript 浮点数精度问题
// - precision: 64: 设置计算精度为 64 位，提供更高的数值精度
const math = create(all, {
  number: 'BigNumber',
  precision: 64
});

// 文本计算器应用主组件
export function TextCalcApp() {
    // 使用 React useState 钩子管理状态
    // lines: 包含输入文本和计算结果的数组
    // 初始值从 localStorage 读取保存的输入，如果不存在则使用空字符串
    const [lines, setLines] = useState<{ input: string; result: string[] }>(() => {
        const savedInput = localStorage.getItem('calcInput') || '';
        return {
            input: savedInput,
            // 如果有保存的输入，立即计算结果显示
            result: savedInput ? calculateResults(savedInput) : []
        };
    });
    
    // copiedLineIndex: 记录哪一行的复制按钮被点击了，用于显示"已复制"反馈
    const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);
    
    // hoveredLineIndex: 记录鼠标悬停在哪一行，用于高亮显示当前行
    const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

    // 处理输入框变化的函数
    const handleInputChange = (value: string) => {
        // 计算新的结果
        const resArray = calculateResults(value);
        // 更新状态
        setLines({ input: value, result: resArray });
        // 将输入保存到 localStorage，实现数据持久化
        localStorage.setItem('calcInput', value);
    };
    
    // 处理复制按钮点击的函数
    const handleCopy = (textToCopy: string, index: number) => {
        // 如果文本为空，不执行复制操作
        if (!textToCopy.trim()) return;
        const resultPart = textToCopy;
        
        // 使用 Clipboard API 复制文本到剪贴板
        navigator.clipboard.writeText(resultPart).then(() => {
            // 复制成功，设置复制状态
            setCopiedLineIndex(index);
            // 2秒后清除复制状态，恢复复制按钮
            setTimeout(() => {
                setCopiedLineIndex(null);
            }, 2000);
        }).catch(err => {
            // 复制失败，在控制台输出错误信息
            console.error('无法复制文本: ', err);
        });
    };
    
    // 组件渲染
    return (
        <div className="container mx-auto p-4 grid grid-cols-2 gap-4 ">
            {/* 左侧：输入区域 */}
            <div className="flex flex-col space-y-2 ">
                <Textarea
                    value={lines.input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={Configs.DefaultTxt}
                    className="w-full min-h-[calc(90vh-1rem)] md:text-2xl font-mono leading-8"
                />
            </div>
            
            {/* 右侧：结果显示区域 */}
            <div className="flex flex-col space-y-2">
                <div className="w-full min-h-[calc(90vh-1rem)] font-bold md:text-2xl font-mono leading-8 px-3 py-2 border bg-background rounded-md overflow-y-auto">
                    {/* 遍历结果显示数组，每行显示计算结果 */}
                    {lines.result.map((line, index) => (
                        <div
                            key={index}
                            className="group flex justify-between items-center h-8" 
                        >
                            {/* 使用 pre 标签保持文本格式，如空格等 */}
                            <pre className="font-bold">
                                <span className={`transition-colors duration-150 rounded px-1 ${
                                    // 如果当前行被悬停，添加背景色高亮
                                    hoveredLineIndex === index ? 'bg-muted' : 'bg-transparent'
                                }`}>
                                    {/* 如果行为空，渲染一个空格保持行高 */}
                                    {line || <>&nbsp;</>}
                                </span>
                            </pre>
                            {/* 如果行不为空，显示复制按钮 */}
                            {line.trim() && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    // 按钮默认透明，当鼠标悬停在该行时变为不透明
                                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleCopy(line, index)}
                                    // 鼠标进入/离开事件，用于更新悬停状态
                                    onMouseEnter={() => setHoveredLineIndex(index)}
                                    onMouseLeave={() => setHoveredLineIndex(null)}
                                >
                                    {/* 如果当前行被复制，显示对勾图标；否则显示复制图标 */}
                                    {copiedLineIndex === index ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">复制此行</span>
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * 计算所有行的结果
 * @param value - 输入的文本，包含多行
 * @returns 每行计算结果的字符串数组
 */
const calculateResults = (value: string): string[] => {
    // 将输入按换行符分割成多行
    const inputLines = value.split('\n');
    const resultLines = [];
    
    // 遍历每一行进行计算
    for (const line of inputLines) {
        // 分离注释和计算部分
        const { lineWithoutComment, comment } = HandleOneLine(line);
        
        // 如果只有注释或空行，保留注释
        if (lineWithoutComment === "") {
            resultLines.push(comment ? `# ${comment}` : '');
            continue;
        }
        
        // 如果是纯数字，直接显示，不进行计算
        if (/^\d+(\.\d+)?$/.test(lineWithoutComment)) {
            resultLines.push(lineWithoutComment);
            continue;
        }
        
        // 计算非注释部分的结果
        let result = GetLineNoCommentResult(lineWithoutComment);
        
        // 如果有注释，附加到结果后面
        if (comment) {
            result += `    # ${comment}`;
        }
        
        resultLines.push(result);
    }
    
    return resultLines;
};

/**
 * 格式化数字类型的计算结果
 * @param evalResult - 需要格式化的数字结果
 * @param needPercent - 是否需要显示百分比（用于股票涨跌幅优化）
 * @returns 格式化后的字符串
 */
function formatEvalResultNumber(evalResult: number, needPercent: boolean): string {
    // 如果是整数，直接返回
    if (Number.isInteger(evalResult)) return evalResult.toString();

    // 获取小数部分
    const decimalPart = evalResult.toString().split('.')[1] || '';
    const decimalLength = decimalPart.length;
    
    let formatted: string;
    
    if (decimalLength <= 10) {
        // 小数位数少于等于10位，使用正常显示
        // 使用 mathjs 的 BigNumber 避免浮点精度误差
        const bnResult = math.bignumber(evalResult);
        // 使用固定小数格式，精度为小数位数或12位（取较小值）
        formatted = math.format(bnResult, { notation: 'fixed', precision: Math.min(decimalLength, 12) });
        // 移除末尾多余的0（如 1.200 变为 1.2）
        formatted = parseFloat(formatted).toString();
    } else {
        // 小数位数多于10位，最多保留10位小数
        const bnResult = math.bignumber(evalResult);
        formatted = math.format(bnResult, { notation: 'fixed', precision: 10 });
        formatted = parseFloat(formatted).toString();
    }
    
    // 股票涨跌幅显示优化
    // 当数值在 [70%, 130%] 范围内时，显示具体的百分比变化
    if (Configs.ShowNumPercentDetail && needPercent && evalResult < 1.3 && evalResult > 0.7) {
        // 计算百分比变化：从1到当前值的变化百分比
        const temp = format(evalResult * 100 - 100, { notation: 'fixed', precision: 2 });
        // 正数添加"+"号
        const fix = evalResult > 1 ? "+" : "";
        const percent = fix + parseFloat(temp).toString() + "%";
        // 将百分比信息附加到结果中
        formatted = `${formatted} (${percent})`;
    }
    
    return formatted;
}

/**
 * 格式化各种类型的计算结果
 * @param evalResult - mathjs 计算的结果，可能是数字、字符串或 mathjs 对象
 * @param needPercent - 是否需要显示百分比
 * @returns 格式化后的字符串
 */
function formatEvalResult(evalResult: MathType, needPercent: boolean): string {
    // 处理数字类型
    if (typeof evalResult === 'number') {
        return formatEvalResultNumber(evalResult, needPercent);
    } 
    // 处理字符串类型
    else if (typeof evalResult === 'string') {
        return evalResult;
    } 
    // 处理对象类型（mathjs 对象）
    else if (evalResult && typeof evalResult === 'object') {
        // 检查是否是 mathjs 的 BigNumber 对象
        if ('isBigNumber' in evalResult) {
            // BigNumber 类型，转换为普通数字后格式化
            const numValue = (evalResult as any).toNumber();
            return formatEvalResultNumber(numValue, needPercent);
        } 
        // 检查是否有 type 属性（mathjs 对象的标识）
        else if ('type' in evalResult) {
            // 复数类型
            if (evalResult.type === 'Complex') {
                return format(evalResult, { notation: 'auto' });
            } 
            // BigNumber 类型
            else if (evalResult.type === 'BigNumber') {
                const numValue = (evalResult as any).toNumber();
                return formatEvalResultNumber(numValue, needPercent);
            } 
            // 单位类型
            else if (evalResult.type === 'Unit') {
                return format(evalResult);
            } 
            // 其他 mathjs 类型
            else {
                return format(evalResult);
            }
        }
    }
    // 如果都不是，返回空字符串
    return "";
}

/**
 * 分离一行中的注释和计算部分
 * @param line - 输入的一行文本
 * @returns 包含计算部分和注释的对象
 */
function HandleOneLine(line: string) {
    const trimmedLine = line.trim();
    // 使用正则表达式匹配注释
    // # 后面的所有内容都被视为注释
    const commentMatch = trimmedLine.match(/#\s*(.+)/);
    let comment = '';
    if (commentMatch) {
        // commentMatch[1] 是正则表达式第一个捕获组的内容，即#后面的注释文本
        comment = commentMatch[1];
    }
    // 移除注释部分，只保留计算表达式
    const lineWithoutComment = trimmedLine.replace(/#.*/, '').trim();
    return { lineWithoutComment, comment };
}

/**
 * 计算一行非注释部分的结果
 * @param inpLine - 不包含注释的输入行
 * @returns 计算结果的字符串
 */
function GetLineNoCommentResult(inpLine: string) {
    let result = '';
    // 将用户输入的乘号'x'替换为数学乘号'*'
    const lineForCalc = inpLine.replaceAll('x', '*');

    // 检查是否是方程求解（包含'a'和'='）
    if (inpLine.includes('a') && inpLine.includes('=')) {
        try {
            // 尝试解一元一次方程
            result = solveEquation(lineForCalc);
            result = `a = ${result}`;
        } catch (error) {
            // 方程求解失败，显示错误信息
            result = `${inpLine}  # 方程求解失败, 请检查方程的格式`;
        }
        return result;
    }

    // 普通表达式计算
    try {
        // 检查是否需要百分比优化（包含除法）
        const needPercent = lineForCalc.includes('/') ? true : false;
        // 使用 mathjs 的高精度计算
        const evalResult = math.evaluate(lineForCalc);
        // 格式化结果
        const formattedResult = formatEvalResult(evalResult, needPercent);
        // 构建最终显示格式：原始表达式 = 计算结果
        result = `${inpLine} = ${formattedResult}`; 
    } catch (error: any) {
        // 计算失败，显示原始表达式
        result = `${inpLine}`;
    }
    return result;
}

/**
 * 解一元一次方程
 * @param equation - 包含'a'变量的方程字符串，如 "2*a+3=7"
 * @returns 方程的解或错误信息
 */
function solveEquation(equation: string): string {
    // 以等号分割方程
    const parts = equation.split('=');
    if (parts.length !== 2) {
        throw new Error("方程格式不正确，应为 '表达式=表达式'");
    }
    const [left, right] = parts;

    // 定义函数 f(a) = 左边表达式 - 右边表达式
    // 方程的解就是 f(a) = 0 时的 a 值
    const f = (a: number): number => {
        // 使用 Function 构造器动态创建函数
        // 注意：这种方法存在安全风险，在生产环境中应考虑其他方案
        const leftFunc = new Function("a", "return " + left);
        const rightFunc = new Function("a", "return " + right);
        return leftFunc(a) - rightFunc(a);
    };

    // 计算 f(0) 和 f(1) 来推导线性函数的斜率和截距
    const f0 = f(0);
    const f1 = f(1);
    const coeff = f1 - f0; // 线性函数的斜率

    // 如果系数为0，方程可能无解或有无穷多解
    if (coeff === 0) {
        if (f0 === 0) return "Infinite solutions"; // 无穷多解
        else return "No solution"; // 无解
    }

    // 求解 a = -f(0) / coeff
    const result = -f0 / coeff;
    
    // 检查小数位数
    const decimalPart = result.toString().split('.')[1] || '';
    const decimalLength = decimalPart.length;
    
    // 如果小数位数多于10位，最多保留10位
    if (decimalLength > 10) {
        return result.toFixed(10);
    }
    
    return result.toString();
}
