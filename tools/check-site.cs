#:package Acornima@1.1.0
#:package AngleSharp@1.8.3
// Checks the site before a commit: index.html parse errors, tag balance, duplicate ids, alt texts, that every local
// reference (HTML src/href, CSS url()) exists, JS syntax (inline and assets/*.js, ES2020), and lists every external
// URL in the served files (there must be no third-party requests: only links and the canonical/og URLs) and the
// font weights declared vs used. Exits with 1 if anything is broken.
// Run from the repository root: ..\Shturmap\eng\dotnet.ps1 run tools/check-site.cs '--' .
using System.Text.RegularExpressions;
using Acornima;
using AngleSharp.Html.Parser;

var dir = args.Length > 0 ? args[0] : ".";
var problems = 0;
var html = File.ReadAllText(Path.Combine(dir, "index.html"));
var errors = new List<string>();
var parser = new HtmlParser();
parser.Error += (_, e) => errors.Add(e is AngleSharp.Html.Dom.Events.HtmlErrorEvent h ? $"{h.Position.Line}:{h.Position.Column} {h.Message}" : e.ToString()!);
var doc = parser.ParseDocument(html);
Console.WriteLine($"HTML parse errors: {errors.Count}");
foreach (var e in errors.Take(20)) Console.WriteLine("  " + e);
problems += errors.Count;

var voids = new HashSet<string> { "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr" };
var stack = new Stack<(string, int)>();
var src = Regex.Replace(html, @"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->", m => new string('\n', m.Value.Count(c => c == '\n')));
foreach (Match m in Regex.Matches(src, @"<(/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(/?)>"))
{
    var name = m.Groups[2].Value.ToLowerInvariant();
    var line = src.Take(m.Index).Count(c => c == '\n') + 1;
    if (m.Groups[1].Value == "/")
    {
        if (stack.Count == 0 || stack.Peek().Item1 != name) { Console.WriteLine($"  mismatch: </{name}> at line {line}"); problems++; continue; }
        stack.Pop();
    }
    else if (!voids.Contains(name) && m.Groups[4].Value != "/") stack.Push((name, line));
}
Console.WriteLine($"Unclosed tags: {stack.Count}");
problems += stack.Count;

var dup = doc.QuerySelectorAll("[id]").Select(e => e.Id!).GroupBy(i => i).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
Console.WriteLine($"Duplicate ids: {(dup.Count == 0 ? "none" : string.Join(", ", dup))}");
var imgs = doc.QuerySelectorAll("img").ToList();
var noAlt = imgs.Where(i => string.IsNullOrWhiteSpace(i.GetAttribute("alt"))).Select(i => i.GetAttribute("src")).ToList();
Console.WriteLine($"Images: {imgs.Count}, without alt: {(noAlt.Count == 0 ? "none" : string.Join(", ", noAlt))}");
problems += dup.Count + noAlt.Count;

// Local references
var refs = doc.QuerySelectorAll("[src],[href],[poster]").Select(e => e.GetAttribute("src") ?? e.GetAttribute("href") ?? e.GetAttribute("poster")!)
    .Where(r => !r.StartsWith("http") && !r.StartsWith("#") && !r.StartsWith("mailto:")).Select(r => (From: "index.html", Path: r)).ToList();
refs.AddRange(doc.QuerySelectorAll("video[poster]").Select(v => (From: "index.html", Path: v.GetAttribute("poster")!)));
foreach (var css in Directory.GetFiles(Path.Combine(dir, "assets"), "*.css"))
    foreach (Match m in Regex.Matches(File.ReadAllText(css), @"url\('?([^')]+)'?\)"))
        if (!m.Groups[1].Value.StartsWith("data:")) refs.Add(("assets/" + Path.GetFileName(css), Path.Combine("assets", m.Groups[1].Value)));
refs = refs.Distinct().ToList();
var missing = refs.Where(r => !File.Exists(Path.Combine(dir, r.Path))).ToList();
Console.WriteLine($"Local references: {refs.Count}, missing: {(missing.Count == 0 ? "none" : string.Join(", ", missing.Select(m => m.Path)))}");
problems += missing.Count;

// JS syntax
var scripts = doc.QuerySelectorAll("script:not([src])").Select((s, i) => ($"inline {i}", s.TextContent)).ToList();
scripts.AddRange(Directory.GetFiles(Path.Combine(dir, "assets"), "*.js").Select(f => ("assets/" + Path.GetFileName(f), File.ReadAllText(f))));
foreach (var (name, code) in scripts)
{
    try { new Parser(new ParserOptions { EcmaVersion = EcmaVersion.ES2020 }).ParseScript(code); Console.WriteLine($"JS {name}: parses as ES2020"); }
    catch (Exception e) { Console.WriteLine($"JS {name}: SYNTAX ERROR {e.Message}"); problems++; }
}

// External URLs anywhere in the served files (text files only); read them: none may be a request to another host.
var served = Directory.GetFiles(dir, "*", SearchOption.AllDirectories)
    .Where(f => !f.Contains(Path.DirectorySeparatorChar + ".git" + Path.DirectorySeparatorChar) && new[] { ".html", ".css", ".js", ".svg" }.Contains(Path.GetExtension(f)));
foreach (var f in served)
    foreach (Match m in Regex.Matches(File.ReadAllText(f), @"https?://[^\s""'<>)]+"))
        Console.WriteLine($"URL {Path.GetRelativePath(dir, f)}: {m.Value}");

// Font weights used vs declared
var cssText = string.Join("\n", Directory.GetFiles(Path.Combine(dir, "assets"), "*.css").Select(File.ReadAllText)) + string.Join("\n", doc.QuerySelectorAll("[style]").Select(e => e.GetAttribute("style")));
var declared = Regex.Matches(cssText, @"@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*font-weight:\s*(\d+)").Select(m => $"{m.Groups[1].Value} {m.Groups[2].Value}").ToList();
Console.WriteLine("Declared faces: " + string.Join(", ", declared));
var used = Regex.Matches(Regex.Replace(cssText, @"@font-face\s*\{[^}]*\}", ""), @"font-weight:\s*(\d+)").Select(m => m.Groups[1].Value).Distinct().OrderBy(x => x);
Console.WriteLine("Weights used in rules: " + string.Join(", ", used) + " (plus 400 by default, 700 for <b>/<strong>/h* unless set)");

Console.WriteLine(problems == 0 ? "OK" : $"{problems} problem(s)");
return problems == 0 ? 0 : 1;
