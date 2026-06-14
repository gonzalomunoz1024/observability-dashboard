package com.dashboard.command.synthetic.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Marks a single JSON field in a request body as dynamically generated.
 *
 * <p><code>path</code> is dot-separated (e.g. <code>customer.email</code>).
 * <code>generator</code> is one of:
 * <ul>
 *   <li><code>uuid</code></li>
 *   <li><code>randomInt</code> — args = [min, max]</li>
 *   <li><code>randomString</code> — args = [length]</li>
 *   <li><code>timestampIso</code></li>
 *   <li><code>timestampMs</code></li>
 *   <li><code>email</code></li>
 *   <li><code>enum</code> — args = list of allowed values</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DynamicField {
    private String path;
    private String generator;
    private List<String> args;
}
