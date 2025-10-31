---
name: vercel-specialist
category: tech
description: Vercel deployment, configuration, and optimization specialist for both apps (web/admin)
usage: Use when deploying, configuring environments, optimizing builds, or troubleshooting Vercel deployments
input: Deployment configuration, environment variables, build settings, app type
output: Vercel configuration files, deployment strategy, optimization recommendations
---

# Vercel Specialist

## Overview

**Purpose**: Expert guidance on Vercel deployment, configuration, and optimization for Astro (web app) and TanStack Start (admin) applications

**Category**: Tech
**Primary Users**: deployment-engineer, tech-lead, astro-engineer, tanstack-start-engineer

## When to Use This Skill

- When deploying applications to Vercel
- Configuring environment variables
- Optimizing build performance
- Setting up preview deployments
- Troubleshooting deployment issues
- Configuring custom domains
- Setting up serverless functions
- Implementing edge middleware

## Prerequisites

**Required:**

- Vercel account and project created
- Application code ready for deployment
- Environment variables documented
- Git repository connected to Vercel

**Optional:**

- Custom domain DNS access
- Team collaboration setup
- Analytics enabled

## Workflow

### Step 1: Project Configuration

**Objective**: Configure Vercel project for optimal deployment

**Actions:**

1. Create vercel.json configuration
2. Configure for Astro or TanStack Start
3. Set build commands and output directories
4. Test configuration locally

**Validation:**

- [ ] Build command executes successfully
- [ ] Output directory correct
- [ ] Install command works with monorepo
- [ ] Framework detection accurate

**Output**: Optimized vercel.json configuration

### Step 2: Environment Variables Setup

**Objective**: Configure environment variables for all environments

**Actions:**

1. Identify required variables
2. Set variables in Vercel dashboard
3. Configure variable scopes
4. Create .env.example

**Validation:**

- [ ] All required variables configured
- [ ] Variables scoped correctly
- [ ] Sensitive data not in git
- [ ] .env.example documented

**Output**: Complete environment configuration

### Step 3: Build Optimization

**Objective**: Optimize build performance and output

**Actions:**

1. Configure build settings
2. Enable build caching
3. Optimize dependencies
4. Configure concurrent builds

**Validation:**

- [ ] Build time < 3 minutes
- [ ] Cache hit rate > 80%
- [ ] Only necessary files included
- [ ] Output size optimized

**Output**: Optimized build configuration

### Step 4: Deployment Configuration

**Objective**: Configure automatic and manual deployments

**Actions:**

1. Configure Git integration
2. Set up preview deployments
3. Configure production deployments
4. Test deployment pipeline

**Validation:**

- [ ] Main branch deploys to production
- [ ] PRs create preview deployments
- [ ] Deployment checks configured
- [ ] Rollback works correctly

**Output**: Complete deployment configuration

### Step 5: Performance Optimization

**Objective**: Optimize deployed application performance

**Actions:**

1. Configure security headers
2. Configure redirects and rewrites
3. Enable Edge Functions if needed
4. Optimize caching strategy

**Validation:**

- [ ] Security headers set
- [ ] Caching configured
- [ ] Redirects working
- [ ] Performance score > 90

**Output**: Optimized deployment configuration

### Step 6: Monitoring & Analytics

**Objective**: Set up monitoring and analytics

**Actions:**

1. Enable Vercel Analytics
2. Configure Web Vitals tracking
3. Set up error tracking (Sentry)
4. Configure logs

**Validation:**

- [ ] Analytics tracking
- [ ] Error reporting working
- [ ] Logs accessible
- [ ] Performance monitored

**Output**: Complete monitoring setup

### Step 7: Custom Domain Configuration

**Objective**: Configure custom domains

**Actions:**

1. Add domain in Vercel
2. Configure DNS records
3. Verify SSL certificate
4. Set up environment-specific domains

**Validation:**

- [ ] Domain resolves correctly
- [ ] SSL certificate active
- [ ] HTTPS enforced
- [ ] Redirects working

**Output**: Production domain configured

## Output

**Produces:**

- vercel.json configuration file
- Environment variables configured
- Deployment pipeline active
- Performance optimizations applied
- Monitoring and analytics enabled

**Success Criteria:**

- Successful production deployment
- Build time < 3 minutes
- Performance score > 90
- Zero deployment errors
- Custom domain working with SSL

## Best Practices

1. **Use Preview Deployments**: Test changes before production
2. **Environment Separation**: Different vars for prod/preview
3. **Enable Analytics**: Monitor real user performance
4. **Configure Caching**: Optimize static assets
5. **Use Edge Functions**: For authentication/routing
6. **Set Security Headers**: Protect against common attacks
7. **Monitor Logs**: Track errors and performance
8. **Automate Deployments**: CI/CD with Git integration
9. **Test Builds Locally**: Use vercel build before pushing
10. **Document Configuration**: Keep vercel.json in git

## Related Skills

- astro-engineer - Astro-specific deployment
- tanstack-start-engineer - TanStack Start deployment
- deployment-engineer - General deployment strategies

## Notes

- Vercel free tier includes 100GB bandwidth
- Build time limit: 45 min (hobby), 8 hours (pro)
- Serverless function timeout: 10s (hobby), 60s (pro)
- Always test deployments in preview first
- Use environment variables for secrets
- Enable automatic previews for all PRs
- Configure build caching for faster builds
- Monitor analytics for performance insights
