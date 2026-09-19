package com.codesymphony.core.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableCaching
public class CacheConfig {

  public static final String PARSED_REPOSITORY_CACHE = "parsedRepositories";
  public static final String REPOSITORY_TREE_CACHE = "repositoryTrees";

  @Bean
  CacheManager cacheManager() {
    CaffeineCacheManager cacheManager =
        new CaffeineCacheManager(PARSED_REPOSITORY_CACHE, REPOSITORY_TREE_CACHE);
    cacheManager.setCaffeine(
        Caffeine.newBuilder().maximumSize(50).expireAfterWrite(1, TimeUnit.HOURS));
    return cacheManager;
  }

  @Bean
  RestClient.Builder restClientBuilder() {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(Duration.ofSeconds(10));
    requestFactory.setReadTimeout(Duration.ofMinutes(2));
    return RestClient.builder().requestFactory(requestFactory);
  }

  @Bean
  WebMvcConfigurer corsConfigurer(CodeSymphonyProperties properties) {
    String[] origins = splitOrigins(properties.corsAllowedOrigins());
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry
            .addMapping("/api/**")
            .allowedOrigins(origins)
            .allowedMethods("GET", "POST", "OPTIONS")
            .allowCredentials(true);
      }
    };
  }

  static String[] splitOrigins(String raw) {
    if (!StringUtils.hasText(raw)) {
      return new String[] {"http://localhost:5173"};
    }
    return Arrays.stream(raw.split(","))
        .map(String::trim)
        .filter(StringUtils::hasText)
        .toArray(String[]::new);
  }
}
