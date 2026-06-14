package com.dashboard.command.synthetic.usecases;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves dynamic placeholders (JMeter-style) in user-provided strings.
 *
 * Supported tokens:
 *   {{uuid}}                    — random UUID v4
 *   {{now}}                     — ISO-8601 current instant
 *   {{timestamp}}               — current epoch milliseconds
 *   {{randomInt(min,max)}}      — inclusive integer in [min,max]
 *   {{randomString(length)}}    — alphanumeric string of given length
 *   {{randomEmail}}             — random local-part + example.com
 *
 * Templates are NOT resolved inside {{id}} (that placeholder is reserved
 * for the probe URL's ID substitution).
 */
@Component
public class TemplateResolver {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{\\s*([a-zA-Z]+)(?:\\(([^)]*)\\))?\\s*}}");
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    public String render(String input) {
        if (input == null || input.isEmpty()) return input;
        Matcher m = TOKEN.matcher(input);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String name = m.group(1).toLowerCase();
            String args = m.group(2);
            String replacement;
            try {
                replacement = resolve(name, args);
            } catch (Exception e) {
                // Leave the original token intact on bad input — caller may surface error elsewhere.
                replacement = m.group(0);
            }
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString();
    }

    private String resolve(String name, String args) {
        switch (name) {
            case "uuid":
                return UUID.randomUUID().toString();
            case "now":
                return Instant.now().toString();
            case "timestamp":
                return String.valueOf(System.currentTimeMillis());
            case "randomint": {
                String[] parts = splitArgs(args, 2);
                int min = Integer.parseInt(parts[0].trim());
                int max = Integer.parseInt(parts[1].trim());
                if (max < min) { int tmp = min; min = max; max = tmp; }
                return String.valueOf(min + RNG.nextInt(max - min + 1));
            }
            case "randomstring": {
                String[] parts = splitArgs(args, 1);
                int len = Integer.parseInt(parts[0].trim());
                if (len < 0) len = 0;
                if (len > 4096) len = 4096;
                StringBuilder sb = new StringBuilder(len);
                for (int i = 0; i < len; i++) {
                    sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
                }
                return sb.toString();
            }
            case "randomemail": {
                StringBuilder sb = new StringBuilder(12);
                for (int i = 0; i < 10; i++) {
                    sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
                }
                return sb.append("@example.com").toString();
            }
            case "id":
                // Reserved for probe-URL id substitution by the probe pipeline.
                return "{{id}}";
            default:
                // Unknown tokens pass through untouched so users notice the typo.
                return "{{" + name + (args != null ? "(" + args + ")" : "") + "}}";
        }
    }

    private String[] splitArgs(String args, int expected) {
        if (args == null) throw new IllegalArgumentException("Missing arguments");
        String[] parts = args.split(",");
        if (parts.length < expected) throw new IllegalArgumentException("Expected " + expected + " args");
        return parts;
    }
}
